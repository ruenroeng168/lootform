-- LOOTFORM Craft Stat Variance + LEGENDARY Bonus Ability Slot
-- Date: 2026-08-28
--
-- Purpose:
--   Tester feedback: every Crafted item of the same (Design, Grade) came
--   out with identical stats -- confirmed as by-design (base_stat * grade
--   multiplier is pure arithmetic, no roll). Product decision (confirmed
--   with Management): add real per-item variance so two items of the same
--   Design/Grade are not numerically identical, and give LEGENDARY an
--   exclusive extra option nothing else gets.
--
--   1. Each of the 6 base stats now rolls independently within
--      +/- variance_percent of the Design/Grade value, instead of being
--      that exact value every time. Range widens with Grade so higher
--      tiers feel more swingy, but the *average* is unchanged so overall
--      balance does not shift:
--        COMMON +/-5%, RARE +/-8%, EPIC +/-12%, LEGENDARY +/-15%
--      (Starting hypothesis values -- Admin/Economy can retune later by
--      editing game_grade_stat_multipliers.variance_percent, same as
--      stat_multiplier already is.)
--
--   2. LEGENDARY-only: a second, independent Ability slot is rolled
--      (any of the 6 shared ability codes except the Design's own one),
--      frozen the same way the primary ability already is. This is the
--      "extra option tier" LEGENDARY gets that no other grade has.
--      Ability *effects* are still not computed in combat anywhere
--      (confirmed unimplemented since 202608260006) -- this bonus slot
--      is data + display today, same maturity level as the primary
--      ability_code_snapshot it sits next to.
--
-- Audited before writing this file:
--   game_grade_stat_multipliers (202608260001) -> existing per-grade
--     tuning table, precedent for adding another per-grade knob here.
--   lootform_craft_atomic (202608260001)       -> single place stats are
--     computed; same function extended, same signature, no API change.
--   items.ability_code_snapshot / ability_config_snapshot -> existing
--     single-ability convention, mirrored for the new bonus_* columns.
--
-- Additive only: new columns (nullable / defaulted), new lookup table.
-- No existing column, row shape, or the Craft probability roll changes.

BEGIN;

-- =========================================================
-- 1. PER-GRADE STAT VARIANCE RANGE
-- =========================================================

ALTER TABLE public.game_grade_stat_multipliers
  ADD COLUMN IF NOT EXISTS variance_percent numeric(5, 2) NOT NULL DEFAULT 0;

UPDATE public.game_grade_stat_multipliers
SET variance_percent = v.variance_percent
FROM (
  VALUES
    ('COMMON', 5.00),
    ('RARE', 8.00),
    ('EPIC', 12.00),
    ('LEGENDARY', 15.00)
) AS v (grade, variance_percent)
WHERE public.game_grade_stat_multipliers.grade = v.grade;

-- =========================================================
-- 2. DEFAULT CONFIG PER ABILITY CODE
--
--    Used only to fill in a sensible ability_config when an ability is
--    rolled as the LEGENDARY bonus slot rather than assigned to a
--    specific Design. Placeholder starting values -- Admin/Economy can
--    retune by editing rows here directly, same convention as
--    product_design_game_stats.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_ability_default_configs (
  ability_code text PRIMARY KEY
    CHECK (
      ability_code IN (
        'BERSERK',
        'FORTIFIED',
        'TREASURE_HUNTER',
        'FIELD_MEDIC',
        'SCOUT',
        'ELITE_HUNTER'
      )
    ),

  ability_config jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_ability_default_configs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.game_ability_default_configs FROM PUBLIC;
REVOKE ALL ON TABLE public.game_ability_default_configs FROM anon;
GRANT SELECT ON TABLE public.game_ability_default_configs TO authenticated;
GRANT ALL ON TABLE public.game_ability_default_configs TO service_role;

DROP POLICY IF EXISTS game_ability_default_configs_read
  ON public.game_ability_default_configs;

CREATE POLICY game_ability_default_configs_read
  ON public.game_ability_default_configs
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.game_ability_default_configs (ability_code, ability_config)
VALUES
  ('BERSERK', '{"hp_threshold_percent":30,"attack_bonus_percent":20}'::jsonb),
  ('FORTIFIED', '{"elite_damage_reduction_percent":12}'::jsonb),
  ('TREASURE_HUNTER', '{"rare_material_drop_bonus_percent":5}'::jsonb),
  ('FIELD_MEDIC', '{"potion_heal_bonus_percent":10}'::jsonb),
  ('SCOUT', '{}'::jsonb),
  ('ELITE_HUNTER', '{}'::jsonb)
ON CONFLICT (ability_code) DO NOTHING;

-- =========================================================
-- 3. ITEM SNAPSHOT COLUMNS FOR THE LEGENDARY BONUS SLOT
-- =========================================================

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS bonus_ability_code_snapshot text,
  ADD COLUMN IF NOT EXISTS bonus_ability_config_snapshot jsonb;

-- =========================================================
-- 4. lootform_craft_atomic -- ROLL VARIANCE + LEGENDARY BONUS SLOT
--
--    Same signature as before (no new parameters). Browser still never
--    supplies any stat, ability, or variance value -- everything below
--    is looked up / rolled server-side inside the same atomic
--    transaction as before.
-- =========================================================

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

  /*
    Fingerprint only the player's requested selection.

    Catalog snapshots / Grade are intentionally excluded:
    a replay after a response was lost must return the already committed
    Craft even if Catalog data changes before the retry reaches the API.
  */
  v_request_fingerprint := md5(
    concat_ws(
      '|',
      p_user_id::text,
      p_product_id::text,
      p_design_id::text,
      upper(BTRIM(p_size))
    )
  );

  /*
    First caller creates the request row.
    A concurrent duplicate request_id waits on the PK conflict until the
    first transaction commits/rolls back, then reads the committed result.
  */
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

  /*
    Keep the Grade chosen by the first request that claimed this request_id.
    This avoids a retry receiving a different server roll.
  */
  v_grade := v_request.rolled_grade;

  /*
    Cast through the real database column types. This keeps the RPC
    compatible whether Grade / Environment are text columns or enums.
  */
  v_item_grade := v_grade;
  v_item_environment := p_environment_mode;
  v_transaction_environment := p_environment_mode;

  /*
    Serialize balance changes for this player.

    Two different Craft requests for the same player cannot both spend
    the same balance snapshot.
  */
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

  /*
    Dedicated sequence is concurrency-safe.
    Sequence values are intentionally allowed to have gaps when a
    transaction fails; uniqueness and correctness are more important than
    gap-free human serials.
  */
  v_serial_number := nextval('public.lootform_item_serial_seq');

  v_serial :=
    'LF-'
    || p_season_code
    || '-'
    || lpad(v_serial_number::text, 4, '0');

  /*
    GAME STATS
    Design -> base profile, Grade -> multiplier, computed server-side.
    Browser never supplies HP/ATK/DEF/LUCK/HEAL/VISION/POWER/Ability.

    Missing profile (design not yet balanced by Admin) or missing
    multiplier row both degrade to "no bonus" rather than failing the
    Craft -- a shirt with no Game Stats configured yet is still a valid,
    purchasable, wearable item.

    Each stat rolls independently within +/- v_variance_percent of the
    Design/Grade value (random(), server-side, inside this SECURITY
    DEFINER transaction -- the browser cannot see or influence the roll).
    A base value of 0 stays 0 regardless of variance (0 * anything = 0),
    so a stat a Design does not use never appears out of nowhere.
  */
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

  v_hp_bonus := ROUND(COALESCE(v_design_stats.base_hp_bonus, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0));
  v_attack_bonus := ROUND(COALESCE(v_design_stats.base_attack_bonus, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0));
  v_defense_bonus := ROUND(COALESCE(v_design_stats.base_defense_bonus, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0));
  v_luck_bonus := ROUND(COALESCE(v_design_stats.base_luck_bonus_percent, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0), 2);
  v_heal_bonus := ROUND(COALESCE(v_design_stats.base_heal_bonus_percent, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0), 2);
  v_vision_bonus := ROUND(COALESCE(v_design_stats.base_vision_bonus, 0) * v_stat_multiplier
    * (1 + (random() * 2 - 1) * v_variance_percent / 100.0));
  v_ability_code := v_design_stats.ability_code;
  v_ability_config := COALESCE(v_design_stats.ability_config, '{}'::jsonb);

  /*
    LEGENDARY-ONLY BONUS ABILITY SLOT.
    Rolled independently of the Design's own ability, excluding it so a
    LEGENDARY item never shows the same ability twice.
  */
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

  /*
    POWER is a display-only overall estimate. The game itself must keep
    using the real stats above -- never this number.
  */
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

  /*
    Return the same public shape the old API selected explicitly, plus the
    new Game Stats fields.
  */
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
