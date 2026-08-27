-- LOOTFORM Crafted Shirt Game Stats
-- Date: 2026-08-26
--
-- Purpose:
--   Give every Crafted item real EXPEDITION MODE stats (HP/ATK/DEF/LUCK/
--   HEAL/VISION), a POWER score and a data-driven Ability, without
--   duplicating the existing Craft/Collection/Equipment system.
--
--   Design -> base stat profile   (product_design_game_stats)
--   Grade  -> stat multiplier     (game_grade_stat_multipliers)
--   Item   -> frozen snapshot     (items.*_snapshot columns, computed once
--                                  inside lootform_craft_atomic so a future
--                                  balance change never retroactively
--                                  changes an item a player already owns)
--
-- Audited before writing this file:
--   products / product_designs   -> where Design already lives
--   items                        -> existing *_snapshot columns/convention
--   grade_score_rules            -> existing "grade -> number" precedent
--     (kept separate: that table is Collection Score, this is gameplay)
--   lootform_craft_atomic        -> single place Items are created
--   game_sessions                -> has no stats snapshot column yet
--
-- This migration is additive only: new tables, new nullable columns.
-- No existing column, row shape, or the Craft probability roll is changed.

BEGIN;

-- =========================================================
-- 1. DESIGN -> BASE GAME STAT PROFILE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.product_design_game_stats (
  design_id bigint PRIMARY KEY
    REFERENCES public.product_designs (id)
    ON DELETE CASCADE,

  ability_code text
    CHECK (
      ability_code IS NULL
      OR ability_code IN (
        'BERSERK',
        'FORTIFIED',
        'TREASURE_HUNTER',
        'FIELD_MEDIC',
        'SCOUT',
        'ELITE_HUNTER'
      )
    ),

  ability_config jsonb NOT NULL DEFAULT '{}'::jsonb,

  base_hp_bonus integer NOT NULL DEFAULT 0,
  base_attack_bonus integer NOT NULL DEFAULT 0,
  base_defense_bonus integer NOT NULL DEFAULT 0,
  base_luck_bonus_percent numeric(5, 2) NOT NULL DEFAULT 0,
  base_heal_bonus_percent numeric(5, 2) NOT NULL DEFAULT 0,
  base_vision_bonus integer NOT NULL DEFAULT 0,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_design_game_stats ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_design_game_stats FROM PUBLIC;
REVOKE ALL ON TABLE public.product_design_game_stats FROM anon;
GRANT SELECT ON TABLE public.product_design_game_stats TO authenticated;
GRANT ALL ON TABLE public.product_design_game_stats TO service_role;

DROP POLICY IF EXISTS product_design_game_stats_read
  ON public.product_design_game_stats;

CREATE POLICY product_design_game_stats_read
  ON public.product_design_game_stats
  FOR SELECT
  TO authenticated
  USING (is_active);

-- =========================================================
-- 2. GRADE -> GAME STAT MULTIPLIER
--
--    Kept separate from grade_score_rules on purpose:
--    that table drives Collection Score / Global Rank, this one
--    drives gameplay stat scaling. Same grade, different meaning.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_grade_stat_multipliers (
  grade text PRIMARY KEY
    CHECK (grade IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),

  stat_multiplier numeric(5, 2) NOT NULL,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_grade_stat_multipliers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.game_grade_stat_multipliers FROM PUBLIC;
REVOKE ALL ON TABLE public.game_grade_stat_multipliers FROM anon;
GRANT SELECT ON TABLE public.game_grade_stat_multipliers TO authenticated;
GRANT ALL ON TABLE public.game_grade_stat_multipliers TO service_role;

DROP POLICY IF EXISTS game_grade_stat_multipliers_read
  ON public.game_grade_stat_multipliers;

CREATE POLICY game_grade_stat_multipliers_read
  ON public.game_grade_stat_multipliers
  FOR SELECT
  TO authenticated
  USING (is_active);

INSERT INTO public.game_grade_stat_multipliers (grade, stat_multiplier)
VALUES
  ('COMMON', 1.00),
  ('RARE', 1.20),
  ('EPIC', 1.50),
  ('LEGENDARY', 2.00)
ON CONFLICT (grade) DO NOTHING;

-- =========================================================
-- 3. SEED DESIGN PROFILES FOR EXISTING DESIGNS
--
--    Starting values only -- Admin can rebalance later by editing
--    these rows (see section 17 of the spec: no new Admin UI this
--    phase, but the schema already supports one).
-- =========================================================

INSERT INTO public.product_design_game_stats (
  design_id, ability_code, ability_config,
  base_hp_bonus, base_attack_bonus, base_defense_bonus,
  base_luck_bonus_percent, base_heal_bonus_percent, base_vision_bonus
)
SELECT v.design_id, v.ability_code, v.ability_config::jsonb,
       v.base_hp_bonus, v.base_attack_bonus, v.base_defense_bonus,
       v.base_luck_bonus_percent, v.base_heal_bonus_percent, v.base_vision_bonus
FROM (
  VALUES
    -- เสื้อยืด (starter TEE)            -> light ASSAULT profile
    (1, 'BERSERK', '{"hp_threshold_percent":30,"attack_bonus_percent":20}',
     10, 5, 2, 0, 0, 0),
    -- POWER-UP TEE D02                  -> ASSAULT
    (2, 'BERSERK', '{"hp_threshold_percent":30,"attack_bonus_percent":25}',
     15, 8, 3, 0, 0, 0),
    -- POWER-UP TEE D03                  -> GUARDIAN
    (3, 'FORTIFIED', '{"elite_damage_reduction_percent":15}',
     15, 3, 8, 0, 0, 0),
    -- VOID HOODIE D01                   -> SCAVENGER
    (4, 'TREASURE_HUNTER', '{"rare_material_drop_bonus_percent":5}',
     8, 0, 0, 3, 0, 1),
    -- หมวก (CAP)                        -> MEDIC-lite utility
    (5, 'FIELD_MEDIC', '{"potion_heal_bonus_percent":10}',
     0, 0, 0, 0, 10, 1)
) AS v (
  design_id, ability_code, ability_config,
  base_hp_bonus, base_attack_bonus, base_defense_bonus,
  base_luck_bonus_percent, base_heal_bonus_percent, base_vision_bonus
)
WHERE EXISTS (
  SELECT 1 FROM public.product_designs pd WHERE pd.id = v.design_id
)
ON CONFLICT (design_id) DO NOTHING;

-- =========================================================
-- 4. ITEM STAT SNAPSHOT COLUMNS
--
--    Nullable: items crafted before this migration simply have no
--    game stats (treated as +0 everywhere they are summed).
-- =========================================================

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS hp_bonus_snapshot integer,
  ADD COLUMN IF NOT EXISTS attack_bonus_snapshot integer,
  ADD COLUMN IF NOT EXISTS defense_bonus_snapshot integer,
  ADD COLUMN IF NOT EXISTS luck_bonus_snapshot numeric(6, 2),
  ADD COLUMN IF NOT EXISTS heal_bonus_snapshot numeric(6, 2),
  ADD COLUMN IF NOT EXISTS vision_bonus_snapshot integer,
  ADD COLUMN IF NOT EXISTS power_score_snapshot integer,
  ADD COLUMN IF NOT EXISTS ability_code_snapshot text,
  ADD COLUMN IF NOT EXISTS ability_config_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS grade_stat_multiplier_snapshot numeric(5, 2);

-- =========================================================
-- 5. GAME SESSION STAT SNAPSHOT
--
--    Frozen effective stats for the run. Equipment changes made
--    after START EXPEDITION must never affect an already-running
--    session (spec section 12/13).
-- =========================================================

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS stats_snapshot jsonb;

-- =========================================================
-- 6. lootform_craft_atomic -- COMPUTE + SNAPSHOT GAME STATS
--
--    Same signature as before (no new parameters): the function already
--    receives p_design_id and p_grade, so it looks up the Design profile
--    and Grade multiplier itself, server-side, inside the same atomic
--    transaction. The Next.js /api/craft route does not change.
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
  v_hp_bonus integer;
  v_attack_bonus integer;
  v_defense_bonus integer;
  v_luck_bonus numeric(6, 2);
  v_heal_bonus numeric(6, 2);
  v_vision_bonus integer;
  v_power_score integer;
  v_ability_code text;
  v_ability_config jsonb;
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
  */
  SELECT *
  INTO v_design_stats
  FROM public.product_design_game_stats
  WHERE design_id = p_design_id
    AND is_active;

  SELECT stat_multiplier
  INTO v_stat_multiplier
  FROM public.game_grade_stat_multipliers
  WHERE grade = v_grade
    AND is_active;

  v_stat_multiplier := COALESCE(v_stat_multiplier, 1.00);

  v_hp_bonus := ROUND(COALESCE(v_design_stats.base_hp_bonus, 0) * v_stat_multiplier);
  v_attack_bonus := ROUND(COALESCE(v_design_stats.base_attack_bonus, 0) * v_stat_multiplier);
  v_defense_bonus := ROUND(COALESCE(v_design_stats.base_defense_bonus, 0) * v_stat_multiplier);
  v_luck_bonus := ROUND(COALESCE(v_design_stats.base_luck_bonus_percent, 0) * v_stat_multiplier, 2);
  v_heal_bonus := ROUND(COALESCE(v_design_stats.base_heal_bonus_percent, 0) * v_stat_multiplier, 2);
  v_vision_bonus := ROUND(COALESCE(v_design_stats.base_vision_bonus, 0) * v_stat_multiplier);
  v_ability_code := v_design_stats.ability_code;
  v_ability_config := COALESCE(v_design_stats.ability_config, '{}'::jsonb);

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
    grade_stat_multiplier_snapshot
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
    v_stat_multiplier
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
      'grade_stat_multiplier', v_item.grade_stat_multiplier_snapshot
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
