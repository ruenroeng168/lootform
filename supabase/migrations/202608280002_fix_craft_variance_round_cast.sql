-- LOOTFORM Fix: Craft variance ROUND() type error
-- Date: 2026-08-28
--
-- Purpose:
--   202608280001 introduced a bug: random() returns double precision, and
--   (numeric * double precision) resolves to double precision, not
--   numeric. ROUND(double precision) with one argument exists, but
--   ROUND(double precision, integer) does NOT -- only ROUND(numeric,
--   integer) does. This made every Craft call to lootform_craft_atomic
--   fail immediately at the LUCK/HEAL bonus lines (the only two using the
--   2-argument ROUND), surfacing to players as "Atomic Craft transaction
--   ไม่พร้อม" on every single Craft attempt.
--
--   Confirmed live in production DB via a standalone DO block before
--   writing this fix (see session notes) -- 42883: function
--   round(double precision, integer) does not exist.
--
-- Fix: cast the variance-factor subexpression to ::numeric before it
-- multiplies into the running total, so the whole expression stays in
-- the numeric domain through to ROUND(). No behavior change beyond
-- making the already-intended variance roll actually execute.

BEGIN;

CREATE OR REPLACE FUNCTION public.lootform_craft_atomic(
  p_request_id uuid,
  p_user_id uuid,
  p_product_id bigint,
  p_design_id bigint,
  p_product_code text,
  p_product_name text,
  p_design_code text,
  p_design_name text,
  p_season_code text,
  p_category text,
  p_equip_slot text,
  p_size text,
  p_craft_cost numeric,
  p_grade text,
  p_thumbnail_url text,
  p_model_url text,
  p_environment_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.craft_requests%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_item public.items%ROWTYPE;
  v_design_stats public.product_design_game_stats%ROWTYPE;

  v_request_fingerprint text;
  v_serial_number bigint;
  v_serial text;
  v_snapshot_at timestamptz := now();
  v_grade text;
  v_item_grade public.items.grade%TYPE;
  v_item_environment public.items.environment_mode%TYPE;
  v_transaction_environment public.wallet_transactions.environment_mode%TYPE;
  v_response jsonb;

  v_stat_multiplier numeric(5, 2);
  v_variance_percent numeric(5, 2);
  v_hp_bonus integer;
  v_attack_bonus integer;
  v_defense_bonus integer;
  v_luck_bonus numeric(6, 2);
  v_heal_bonus numeric(6, 2);
  v_vision_bonus integer;
  v_power_score integer;
  v_ability_code text;
  v_ability_config jsonb;
  v_bonus_ability_code text;
  v_bonus_ability_config jsonb;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_REQUEST_ID'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_USER_ID'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_product_id IS NULL OR p_product_id <= 0
     OR p_design_id IS NULL OR p_design_id <= 0
  THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_CATALOG_SELECTION'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(BTRIM(p_size), '') = '' THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_SIZE'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_craft_cost IS NULL OR p_craft_cost < 0 THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_CRAFT_COST'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_grade NOT IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY') THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_GRADE'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_environment_mode NOT IN ('TEST', 'LIVE') THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_ENVIRONMENT_MODE'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(BTRIM(p_thumbnail_url), '') = '' THEN
    RAISE EXCEPTION 'LOOTFORM_GRADE_ASSET_NOT_READY'
      USING ERRCODE = 'P0001';
  END IF;

  v_request_fingerprint := md5(
    concat_ws(
      '|',
      p_user_id::text,
      p_product_id::text,
      p_design_id::text,
      upper(BTRIM(p_size))
    )
  );

  INSERT INTO public.craft_requests (
    request_id,
    user_id,
    request_fingerprint,
    rolled_grade,
    status
  )
  VALUES (
    p_request_id,
    p_user_id,
    v_request_fingerprint,
    p_grade,
    'PROCESSING'
  )
  ON CONFLICT (request_id) DO NOTHING;

  SELECT *
  INTO v_request
  FROM public.craft_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOOTFORM_CRAFT_REQUEST_LOCK_FAILED'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.user_id <> p_user_id THEN
    RAISE EXCEPTION 'LOOTFORM_REQUEST_ID_CONFLICT'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.request_fingerprint <> v_request_fingerprint THEN
    RAISE EXCEPTION 'LOOTFORM_REQUEST_ID_PAYLOAD_MISMATCH'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status = 'COMPLETED' THEN
    IF v_request.response IS NULL THEN
      RAISE EXCEPTION 'LOOTFORM_IDEMPOTENT_RESPONSE_MISSING'
        USING ERRCODE = 'P0001';
    END IF;

    RETURN v_request.response
      || jsonb_build_object(
        'idempotent_replay',
        true
      );
  END IF;

  v_grade := v_request.rolled_grade;

  v_item_grade := v_grade;
  v_item_environment := p_environment_mode;
  v_transaction_environment := p_environment_mode;

  SELECT *
  INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOOTFORM_WALLET_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_wallet.balance, 0) < p_craft_cost THEN
    RAISE EXCEPTION 'LOOTFORM_INSUFFICIENT_BALANCE'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.wallets
  SET
    balance = balance - p_craft_cost,
    updated_at = v_snapshot_at
  WHERE user_id = p_user_id
  RETURNING *
  INTO v_wallet;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOOTFORM_WALLET_UPDATE_FAILED'
      USING ERRCODE = 'P0001';
  END IF;

  v_serial_number := nextval('public.lootform_item_serial_seq');

  v_serial :=
    'LF-'
    || p_season_code
    || '-'
    || lpad(v_serial_number::text, 4, '0');

  SELECT *
  INTO v_design_stats
  FROM public.product_design_game_stats
  WHERE design_id = p_design_id
    AND is_active;

  SELECT stat_multiplier, variance_percent
  INTO v_stat_multiplier, v_variance_percent
  FROM public.game_grade_stat_multipliers
  WHERE grade = v_grade
    AND is_active;

  v_stat_multiplier := COALESCE(v_stat_multiplier, 1.00);
  v_variance_percent := COALESCE(v_variance_percent, 0);

  /*
    FIX: cast the variance-factor subexpression to ::numeric. random()
    is double precision; without the cast, the running product becomes
    double precision and ROUND(double precision, 2) does not exist in
    Postgres (only ROUND(numeric, 2) does), which made every Craft call
    fail on the LUCK/HEAL lines below.
  */
  v_hp_bonus := ROUND(COALESCE(v_design_stats.base_hp_bonus, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0)::numeric);
  v_attack_bonus := ROUND(COALESCE(v_design_stats.base_attack_bonus, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0)::numeric);
  v_defense_bonus := ROUND(COALESCE(v_design_stats.base_defense_bonus, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0)::numeric);
  v_luck_bonus := ROUND(COALESCE(v_design_stats.base_luck_bonus_percent, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0)::numeric, 2);
  v_heal_bonus := ROUND(COALESCE(v_design_stats.base_heal_bonus_percent, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0)::numeric, 2);
  v_vision_bonus := ROUND(COALESCE(v_design_stats.base_vision_bonus, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0)::numeric);
  v_ability_code := v_design_stats.ability_code;
  v_ability_config := COALESCE(v_design_stats.ability_config, '{}'::jsonb);

  IF v_grade = 'LEGENDARY' THEN
    SELECT code
    INTO v_bonus_ability_code
    FROM unnest(ARRAY[
      'BERSERK', 'FORTIFIED', 'TREASURE_HUNTER',
      'FIELD_MEDIC', 'SCOUT', 'ELITE_HUNTER'
    ]) AS code
    WHERE code IS DISTINCT FROM v_ability_code
    ORDER BY random()
    LIMIT 1;

    SELECT ability_config
    INTO v_bonus_ability_config
    FROM public.game_ability_default_configs
    WHERE ability_code = v_bonus_ability_code;

    v_bonus_ability_config := COALESCE(v_bonus_ability_config, '{}'::jsonb);
  ELSE
    v_bonus_ability_code := NULL;
    v_bonus_ability_config := NULL;
  END IF;

  v_power_score := ROUND(
    v_attack_bonus * 1.5
    + v_defense_bonus * 1.2
    + v_hp_bonus * 0.5
    + v_vision_bonus * 3
    + v_luck_bonus * 4
    + v_heal_bonus * 2
  );

  INSERT INTO public.items (
    serial,
    product,
    season,
    product_id,
    design_id,
    grade,
    level,
    size,
    owner_id,
    production_status,
    production_updated_at,
    environment_mode,
    product_code_snapshot,
    product_name_snapshot,
    design_code_snapshot,
    design_name_snapshot,
    season_snapshot,
    category_snapshot,
    equip_slot_snapshot,
    craft_cost_lt_snapshot,
    thumbnail_url_snapshot,
    model_url_snapshot,
    catalog_snapshot_at,
    hp_bonus_snapshot,
    attack_bonus_snapshot,
    defense_bonus_snapshot,
    luck_bonus_snapshot,
    heal_bonus_snapshot,
    vision_bonus_snapshot,
    power_score_snapshot,
    ability_code_snapshot,
    ability_config_snapshot,
    grade_stat_multiplier_snapshot,
    bonus_ability_code_snapshot,
    bonus_ability_config_snapshot
  )
  VALUES (
    v_serial,
    p_product_name,
    p_season_code,
    p_product_id,
    p_design_id,
    v_item_grade,
    0,
    upper(BTRIM(p_size)),
    p_user_id,
    'CRAFTED',
    v_snapshot_at,
    v_item_environment,
    p_product_code,
    p_product_name,
    p_design_code,
    p_design_name,
    p_season_code,
    p_category,
    p_equip_slot,
    p_craft_cost,
    p_thumbnail_url,
    NULLIF(BTRIM(p_model_url), ''),
    v_snapshot_at,
    v_hp_bonus,
    v_attack_bonus,
    v_defense_bonus,
    v_luck_bonus,
    v_heal_bonus,
    v_vision_bonus,
    v_power_score,
    v_ability_code,
    v_ability_config,
    v_stat_multiplier,
    v_bonus_ability_code,
    v_bonus_ability_config
  )
  RETURNING *
  INTO v_item;

  INSERT INTO public.wallet_transactions (
    user_id,
    type,
    amount,
    description,
    item_id,
    environment_mode
  )
  VALUES (
    p_user_id,
    'CRAFT',
    -p_craft_cost,
    concat_ws(
      ' / ',
      'CRAFT',
      p_product_name,
      p_design_code,
      p_season_code,
      v_grade,
      upper(BTRIM(p_size)),
      v_serial
    ),
    v_item.id,
    v_transaction_environment
  );

  v_response := jsonb_build_object(
    'item',
    jsonb_build_object(
      'id', v_item.id,
      'serial', v_item.serial,
      'product', v_item.product,
      'season', v_item.season,
      'product_id', v_item.product_id,
      'design_id', v_item.design_id,
      'grade', v_item.grade,
      'level', v_item.level,
      'size', v_item.size,
      'owner_id', v_item.owner_id,
      'production_status', v_item.production_status,
      'tracking_number', v_item.tracking_number,
      'production_updated_at', v_item.production_updated_at,
      'environment_mode', v_item.environment_mode,
      'product_code_snapshot', v_item.product_code_snapshot,
      'product_name_snapshot', v_item.product_name_snapshot,
      'design_code_snapshot', v_item.design_code_snapshot,
      'design_name_snapshot', v_item.design_name_snapshot,
      'season_snapshot', v_item.season_snapshot,
      'category_snapshot', v_item.category_snapshot,
      'equip_slot_snapshot', v_item.equip_slot_snapshot,
      'craft_cost_lt_snapshot', v_item.craft_cost_lt_snapshot,
      'thumbnail_url_snapshot', v_item.thumbnail_url_snapshot,
      'model_url_snapshot', v_item.model_url_snapshot,
      'catalog_snapshot_at', v_item.catalog_snapshot_at,
      'created_at', v_item.created_at,
      'hp_bonus', v_item.hp_bonus_snapshot,
      'attack_bonus', v_item.attack_bonus_snapshot,
      'defense_bonus', v_item.defense_bonus_snapshot,
      'luck_bonus', v_item.luck_bonus_snapshot,
      'heal_bonus', v_item.heal_bonus_snapshot,
      'vision_bonus', v_item.vision_bonus_snapshot,
      'power_score', v_item.power_score_snapshot,
      'ability_code', v_item.ability_code_snapshot,
      'ability_config', v_item.ability_config_snapshot,
      'grade_stat_multiplier', v_item.grade_stat_multiplier_snapshot,
      'bonus_ability_code', v_item.bonus_ability_code_snapshot,
      'bonus_ability_config', v_item.bonus_ability_config_snapshot
    ),
    'wallet',
    jsonb_build_object(
      'id', v_wallet.id,
      'user_id', v_wallet.user_id,
      'balance', v_wallet.balance,
      'updated_at', v_wallet.updated_at
    ),
    'request_id',
    p_request_id,
    'idempotent_replay',
    false
  );

  UPDATE public.craft_requests
  SET
    status = 'COMPLETED',
    response = v_response,
    completed_at = v_snapshot_at
  WHERE request_id = p_request_id;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.lootform_craft_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text,
  text, text, text, text, numeric, text, text, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.lootform_craft_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text,
  text, text, text, text, numeric, text, text, text, text
) FROM anon;

REVOKE ALL ON FUNCTION public.lootform_craft_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text,
  text, text, text, text, numeric, text, text, text, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.lootform_craft_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text,
  text, text, text, text, numeric, text, text, text, text
) TO service_role;

COMMIT;
