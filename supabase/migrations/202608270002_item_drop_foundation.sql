-- LOOTFORM Authoritative Item + Server Drop (STEP 4B)
-- Date: 2026-08-27
--
-- Purpose:
--   Give a real reason to fight: a defeated Monster/Elite can now
--   roll a stackable Game Material as UNEXTRACTED run loot, fully
--   server-authoritative. Never LT. Never permanent inventory yet
--   (that is STEP 4C Extraction).
--
-- Audited before writing this file:
--   No stackable item/inventory tables exist anywhere in this
--   project. public.items + public.player_equipment are unique,
--   serialized, physical/crafted shirt ownership -- explicitly NOT
--   reused here per this STEP's own instruction to keep stackable
--   game materials in a separate schema.
--
--   LUCK: stats_snapshot.effective.luck currently only ever comes
--   from product_design_game_stats.base_luck_bonus_percent (only one
--   live design has a non-zero value: 3.00) times
--   game_grade_stat_multipliers (max 2.0x). There is no existing
--   spec for how this percent-like number should convert into a
--   safe relative modifier on drop chance. Per this STEP's own
--   explicit escape hatch ("if ambiguous, do not invent a formula"),
--   LUCK is NOT applied to drop rolls in this migration --
--   reported as LUCK_DROP_PENDING_BALANCE.
--
--   Treasure/Cache remains client telemetry only (TREASURE_FOUND
--   event, no server authority) -- left untouched, reported as
--   CACHE_DROP_AUTHORITY_PENDING. Only Monster/Elite defeat (already
--   fully authoritative via resolve_combat) is in scope here.
--
-- Drop resolution rides inside resolve_combat()'s existing win
-- branch, in the same transaction that flips the encounter
-- ACTIVE->DEFEATED and inserts the MONSTER_DEFEATED game_events row
-- (exactly the same pattern STEP 3 used for GAME_COIN). A second
-- call against the same encounter never reaches that branch again
-- (ENCOUNTER_NOT_ACTIVE), so the roll structurally cannot happen
-- twice. The unique index on (game_event_id, roll_type) in
-- game_session_loot is a second, independent backstop: if that
-- guard were ever bypassed by a future bug, the insert raises and
-- the whole transaction (including GAME_COIN) rolls back instead of
-- silently granting a second drop.

BEGIN;

-- =========================================================
-- 1. ITEM DEFINITIONS (data-driven catalog)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_item_definitions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'MATERIAL',
  rarity text NOT NULL CHECK (rarity IN ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY')),
  stackable boolean NOT NULL DEFAULT true,
  tradable boolean NOT NULL DEFAULT false,
  max_stack integer,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.game_item_definitions IS
  'Data-driven catalog of stackable Game Materials -- separate from '
  'public.items (unique serialized crafted shirts). Public read-only '
  'reference data; only SECURITY DEFINER functions ever grant them.';

ALTER TABLE public.game_item_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_item_definitions_authenticated_read_active
  ON public.game_item_definitions;

CREATE POLICY game_item_definitions_authenticated_read_active
  ON public.game_item_definitions
  FOR SELECT
  TO authenticated
  USING (is_active = true);

INSERT INTO public.game_item_definitions
  (code, name, description, category, rarity, stackable, tradable)
SELECT * FROM (VALUES
  ('TECH_FIBER', 'Tech Fiber', 'Basic shirt enhancement material.', 'MATERIAL', 'COMMON', true, false),
  ('ENERGY_CELL', 'Energy Cell', 'Utility / enhancement material.', 'MATERIAL', 'COMMON', true, false),
  ('NANO_GEL', 'Nano Gel', 'Medicine / upgrade ingredient.', 'MATERIAL', 'UNCOMMON', true, false),
  ('ALLOY_THREAD', 'Alloy Thread', 'Mid-tier shirt enhancement material.', 'MATERIAL', 'RARE', true, false),
  ('NEON_CATALYST', 'Neon Catalyst', 'High-tier enhancement material.', 'MATERIAL', 'EPIC', true, false)
) AS seed(code, name, description, category, rarity, stackable, tradable)
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_item_definitions
  WHERE game_item_definitions.code = seed.code
);

-- =========================================================
-- 2. PERMANENT PLAYER INVENTORY (destination for future STEP 4C
--    Extraction -- NOT written by this STEP)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.player_game_inventory (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  item_definition_id bigint NOT NULL REFERENCES public.game_item_definitions(id),
  quantity bigint NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_game_inventory_user_item_unique UNIQUE (user_id, item_definition_id)
);

COMMENT ON TABLE public.player_game_inventory IS
  'AUTHORITATIVE permanent Game Material inventory. Empty/unused as '
  'of STEP 4B -- this is the future settlement target for STEP 4C '
  'Extraction, not written by resolve_combat(). Never written by the '
  'client.';

ALTER TABLE public.player_game_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_game_inventory_select_own
  ON public.player_game_inventory;

CREATE POLICY player_game_inventory_select_own
  ON public.player_game_inventory
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 3. RUN LOOT (per-session UNEXTRACTED loot -- STEP 4B's actual
--    output). Survives refresh; is not permanent inventory.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_session_loot (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.game_sessions(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  encounter_id bigint REFERENCES public.game_encounters(id),
  game_event_id bigint REFERENCES public.game_events(id),
  item_definition_id bigint NOT NULL REFERENCES public.game_item_definitions(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rarity_snapshot text NOT NULL,
  source_type text NOT NULL,
  roll_type text NOT NULL,
  status text NOT NULL DEFAULT 'UNEXTRACTED' CHECK (status IN ('UNEXTRACTED', 'EXTRACTED', 'LOST')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.game_session_loot IS
  'AUTHORITATIVE per-Expedition UNEXTRACTED loot. Belongs to '
  'session+user but is NOT permanent inventory -- STEP 4C decides '
  'EXTRACTED vs LOST. Written only by roll_and_grant_item_drop() '
  '(SECURITY DEFINER, called from resolve_combat). The unique index '
  'on (game_event_id, roll_type) makes each authoritative kill event '
  'resolve at most one drop per roll slot (SINGLE for Normal, '
  'GUARANTEED + BONUS for Elite), surviving retry/refresh/double-'
  'click/concurrent requests.';

CREATE UNIQUE INDEX IF NOT EXISTS game_session_loot_unique_event_roll_idx
  ON public.game_session_loot (game_event_id, roll_type)
  WHERE game_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS game_session_loot_session_idx
  ON public.game_session_loot (session_id);

CREATE INDEX IF NOT EXISTS game_session_loot_user_idx
  ON public.game_session_loot (user_id, created_at DESC);

ALTER TABLE public.game_session_loot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_session_loot_select_own
  ON public.game_session_loot;

CREATE POLICY game_session_loot_select_own
  ON public.game_session_loot
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 4. DROP TABLE CONFIG (data-driven, Beta V0.1 hypothesis --
--    RLS enabled with NO policies: client cannot read percentages)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_item_drop_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id bigint NOT NULL REFERENCES public.games(id),
  source_type text NOT NULL,
  roll_type text NOT NULL,
  tier text NOT NULL,
  item_definition_id bigint REFERENCES public.game_item_definitions(id),
  weight integer NOT NULL CHECK (weight > 0 AND weight <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.game_item_drop_rules IS
  'Beta V0.1 drop table. item_definition_id NULL = a "no drop" '
  'outcome for that weight share. Weights for a given '
  '(game_id, source_type, roll_type, tier) group should sum to 100. '
  'Owned by Game Economy / Game Design per /lootform-growth; adjust '
  'here, never hard-code probabilities in a function body.';

ALTER TABLE public.game_item_drop_rules ENABLE ROW LEVEL SECURITY;

-- Normal Monster (SCOUT + GUARD tiers): single roll.
-- TECH_FIBER 35 / ENERGY_CELL 20 / NANO_GEL 8 / ALLOY_THREAD 2 / NO_ITEM 35
INSERT INTO public.game_item_drop_rules
  (game_id, source_type, roll_type, tier, item_definition_id, weight)
SELECT 1, 'MONSTER_REWARD', 'SINGLE', tier_seed.tier, item_seed.item_id, item_seed.weight
FROM (VALUES ('SCOUT'), ('GUARD')) AS tier_seed(tier)
CROSS JOIN (
  SELECT 'TECH_FIBER' AS code, 35 AS weight
  UNION ALL SELECT 'ENERGY_CELL', 20
  UNION ALL SELECT 'NANO_GEL', 8
  UNION ALL SELECT 'ALLOY_THREAD', 2
) AS drop_seed
CROSS JOIN LATERAL (
  SELECT id AS item_id, drop_seed.weight AS weight
  FROM public.game_item_definitions
  WHERE code = drop_seed.code
) AS item_seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_item_drop_rules
  WHERE game_id = 1 AND source_type = 'MONSTER_REWARD' AND roll_type = 'SINGLE'
    AND tier = tier_seed.tier AND item_definition_id = item_seed.item_id
);

INSERT INTO public.game_item_drop_rules
  (game_id, source_type, roll_type, tier, item_definition_id, weight)
SELECT 1, 'MONSTER_REWARD', 'SINGLE', tier_seed.tier, NULL, 35
FROM (VALUES ('SCOUT'), ('GUARD')) AS tier_seed(tier)
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_item_drop_rules
  WHERE game_id = 1 AND source_type = 'MONSTER_REWARD' AND roll_type = 'SINGLE'
    AND tier = tier_seed.tier AND item_definition_id IS NULL
);

-- Elite ROLL A -- guaranteed basic material.
-- TECH_FIBER 45 / ENERGY_CELL 35 / NANO_GEL 20
INSERT INTO public.game_item_drop_rules
  (game_id, source_type, roll_type, tier, item_definition_id, weight)
SELECT 1, 'ELITE_REWARD', 'GUARANTEED', 'ELITE', item_seed.item_id, item_seed.weight
FROM (
  SELECT 'TECH_FIBER' AS code, 45 AS weight
  UNION ALL SELECT 'ENERGY_CELL', 35
  UNION ALL SELECT 'NANO_GEL', 20
) AS drop_seed
CROSS JOIN LATERAL (
  SELECT id AS item_id, drop_seed.weight AS weight
  FROM public.game_item_definitions
  WHERE code = drop_seed.code
) AS item_seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_item_drop_rules
  WHERE game_id = 1 AND source_type = 'ELITE_REWARD' AND roll_type = 'GUARANTEED'
    AND tier = 'ELITE' AND item_definition_id = item_seed.item_id
);

-- Elite ROLL B -- bonus rare roll.
-- ALLOY_THREAD 20 / NEON_CATALYST 4 / NO_BONUS 76
INSERT INTO public.game_item_drop_rules
  (game_id, source_type, roll_type, tier, item_definition_id, weight)
SELECT 1, 'ELITE_REWARD', 'BONUS', 'ELITE', item_seed.item_id, item_seed.weight
FROM (
  SELECT 'ALLOY_THREAD' AS code, 20 AS weight
  UNION ALL SELECT 'NEON_CATALYST', 4
) AS drop_seed
CROSS JOIN LATERAL (
  SELECT id AS item_id, drop_seed.weight AS weight
  FROM public.game_item_definitions
  WHERE code = drop_seed.code
) AS item_seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_item_drop_rules
  WHERE game_id = 1 AND source_type = 'ELITE_REWARD' AND roll_type = 'BONUS'
    AND tier = 'ELITE' AND item_definition_id = item_seed.item_id
);

INSERT INTO public.game_item_drop_rules
  (game_id, source_type, roll_type, tier, item_definition_id, weight)
SELECT 1, 'ELITE_REWARD', 'BONUS', 'ELITE', NULL, 76
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_item_drop_rules
  WHERE game_id = 1 AND source_type = 'ELITE_REWARD' AND roll_type = 'BONUS'
    AND tier = 'ELITE' AND item_definition_id IS NULL
);

-- =========================================================
-- 5. ROLL + GRANT HELPER (SECURITY DEFINER)
--
-- Pure server RNG (Postgres random()). Never takes a client-supplied
-- seed or result. Returns NULL fields when the roll landed on a
-- "no drop" outcome -- caller (resolve_combat) simply omits it from
-- the response, no row is written for a no-drop roll.
-- =========================================================

CREATE OR REPLACE FUNCTION public.roll_and_grant_item_drop(
  p_session_id uuid,
  p_user_id uuid,
  p_game_id bigint,
  p_encounter_id bigint,
  p_source_type text,
  p_roll_type text,
  p_tier text,
  p_game_event_id bigint
)
RETURNS TABLE (
  loot_id bigint,
  item_code text,
  item_name text,
  rarity text,
  quantity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roll numeric := random() * 100;
  v_cursor numeric := 0;
  v_rule record;
  v_item_id bigint := NULL;
  v_item record;
  v_loot_id bigint;
BEGIN
  FOR v_rule IN
    SELECT item_definition_id, weight
    FROM public.game_item_drop_rules
    WHERE game_id = p_game_id
      AND source_type = p_source_type
      AND roll_type = p_roll_type
      AND tier = p_tier
      AND is_active = true
    ORDER BY id
  LOOP
    v_cursor := v_cursor + v_rule.weight;

    IF v_roll < v_cursor THEN
      v_item_id := v_rule.item_definition_id;
      EXIT;
    END IF;
  END LOOP;

  IF v_item_id IS NULL THEN
    RETURN;
  END IF;

  SELECT d.code, d.name, d.rarity
  INTO v_item
  FROM public.game_item_definitions d
  WHERE d.id = v_item_id;

  INSERT INTO public.game_session_loot (
    session_id, user_id, encounter_id, game_event_id,
    item_definition_id, quantity, rarity_snapshot, source_type, roll_type
  )
  VALUES (
    p_session_id, p_user_id, p_encounter_id, p_game_event_id,
    v_item_id, 1, v_item.rarity, p_source_type, p_roll_type
  )
  RETURNING id INTO v_loot_id;

  RETURN QUERY
    SELECT v_loot_id, v_item.code, v_item.name, v_item.rarity, 1;
END;
$$;

REVOKE ALL ON FUNCTION public.roll_and_grant_item_drop(
  uuid, uuid, bigint, bigint, text, text, text, bigint
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.roll_and_grant_item_drop(
  uuid, uuid, bigint, bigint, text, text, text, bigint
) FROM anon;

REVOKE ALL ON FUNCTION public.roll_and_grant_item_drop(
  uuid, uuid, bigint, bigint, text, text, text, bigint
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.roll_and_grant_item_drop(
  uuid, uuid, bigint, bigint, text, text, text, bigint
) TO service_role;

-- =========================================================
-- 6. WIRE INTO resolve_combat() -- roll drop(s) on the SAME win
--    branch, same transaction, same v_event_id used for GAME_COIN.
-- =========================================================

CREATE OR REPLACE FUNCTION public.resolve_combat(
  p_session_id uuid,
  p_user_id uuid,
  p_encounter_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.game_sessions%ROWTYPE;
  v_state public.game_session_state%ROWTYPE;
  v_encounter public.game_encounters%ROWTYPE;
  v_rule record;

  v_player_atk integer;
  v_player_def integer;
  v_player_hp integer;
  v_monster_hp integer;

  v_round integer := 0;
  v_hero_damage integer;
  v_monster_damage integer;
  v_rounds jsonb := '[]'::jsonb;

  v_won boolean;
  v_now timestamptz := now();
  v_response jsonb;

  v_event_id bigint;
  v_coin_source text;
  v_coin_min integer;
  v_coin_max integer;
  v_coin_amount integer := 0;
  v_coin_balance bigint;

  v_drop_source text;
  v_drops jsonb := '[]'::jsonb;
  v_drop record;
BEGIN
  SELECT *
  INTO v_session
  FROM public.game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAME_SESSION_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_session.user_id <> p_user_id THEN
    RAISE EXCEPTION 'GAME_SESSION_FORBIDDEN'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_session.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'GAME_SESSION_NOT_ACTIVE'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_state
  FROM public.game_session_state
  WHERE session_id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAME_SESSION_STATE_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_encounter
  FROM public.game_encounters
  WHERE id = p_encounter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENCOUNTER_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_encounter.session_id <> p_session_id THEN
    RAISE EXCEPTION 'ENCOUNTER_SESSION_MISMATCH'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_encounter.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'ENCOUNTER_NOT_ACTIVE'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT code, name, base_hp, base_atk, base_def, base_score
  INTO v_rule
  FROM public.game_monster_rules
  WHERE game_id = v_session.game_id
    AND tier = v_encounter.tier
    AND is_boss = false
    AND is_active = true
  ORDER BY sort_order
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MONSTER_RULE_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  v_player_atk :=
    COALESCE(
      (v_session.stats_snapshot -> 'effective' ->> 'attack')::integer,
      8
    );

  v_player_def :=
    COALESCE(
      (v_session.stats_snapshot -> 'effective' ->> 'defense')::integer,
      8
    );

  v_player_hp :=
    COALESCE(
      v_state.player_current_hp,
      COALESCE(
        (v_session.stats_snapshot -> 'effective' ->> 'hp')::integer,
        100
      )
    );

  v_monster_hp :=
    COALESCE(
      v_encounter.current_hp,
      v_rule.base_hp
    );

  WHILE v_player_hp > 0
        AND v_monster_hp > 0
        AND v_round < 60
  LOOP
    v_round := v_round + 1;

    v_hero_damage :=
      GREATEST(
        1,
        ROUND(
          v_player_atk * 100.0
            / (100 + v_rule.base_def)
        )
      );

    v_monster_hp :=
      GREATEST(
        0,
        v_monster_hp - v_hero_damage
      );

    v_monster_damage := 0;

    IF v_monster_hp > 0 THEN
      v_monster_damage :=
        GREATEST(
          1,
          ROUND(
            v_rule.base_atk * 100.0
              / (100 + v_player_def)
          )
        );

      v_player_hp :=
        GREATEST(
          0,
          v_player_hp - v_monster_damage
        );
    END IF;

    v_rounds :=
      v_rounds || jsonb_build_object(
        'round', v_round,
        'heroDamage', v_hero_damage,
        'monsterDamage', v_monster_damage,
        'heroHpAfter', v_player_hp,
        'monsterHpAfter', v_monster_hp
      );
  END LOOP;

  v_won := v_monster_hp <= 0;

  UPDATE public.game_session_state
  SET
    player_current_hp = v_player_hp,
    updated_at = v_now
  WHERE session_id = p_session_id;

  IF v_won THEN
    UPDATE public.game_encounters
    SET
      status = 'DEFEATED',
      current_hp = 0,
      resolved_at = v_now
    WHERE id = p_encounter_id;

    INSERT INTO public.game_events (
      session_id,
      game_id,
      user_id,
      event_type,
      event_name,
      numeric_value,
      payload
    )
    VALUES (
      p_session_id,
      v_session.game_id,
      p_user_id,
      'CUSTOM',
      'MONSTER_DEFEATED',
      v_rule.base_score,
      jsonb_build_object(
        'source', 'GRID_EXPEDITION',
        'map', 'SECTOR_A_01',
        'monster', v_rule.name,
        'tier', v_encounter.tier,
        'encounter_id', v_encounter.id,
        'rounds', v_round,
        'hp_left', v_player_hp,
        'score_gain', v_rule.base_score,
        'authoritative', true
      )
    )
    RETURNING id INTO v_event_id;

    v_coin_source :=
      CASE
        WHEN v_encounter.tier = 'ELITE' THEN 'ELITE_REWARD'
        ELSE 'MONSTER_REWARD'
      END;

    SELECT min_amount, max_amount
    INTO v_coin_min, v_coin_max
    FROM public.game_coin_reward_rules
    WHERE game_id = v_session.game_id
      AND source = v_coin_source
      AND tier = v_encounter.tier
      AND is_active = true
    LIMIT 1;

    IF FOUND THEN
      v_coin_amount :=
        v_coin_min + FLOOR(RANDOM() * (v_coin_max - v_coin_min + 1))::integer;
    END IF;

    IF v_coin_amount > 0 THEN
      SELECT new_balance
      INTO v_coin_balance
      FROM public.credit_game_coin(
        p_user_id,
        v_session.game_id,
        v_coin_amount,
        v_coin_source,
        p_session_id,
        v_event_id
      );
    ELSE
      SELECT balance INTO v_coin_balance
      FROM public.game_coin_wallets
      WHERE user_id = p_user_id AND game_id = v_session.game_id;
    END IF;

    -- ITEM DROP (STEP 4B). Same v_event_id as GAME_COIN above --
    -- one authoritative kill, at most one roll per roll slot.
    v_drop_source := v_coin_source;

    IF v_encounter.tier = 'ELITE' THEN
      FOR v_drop IN
        SELECT * FROM public.roll_and_grant_item_drop(
          p_session_id, p_user_id, v_session.game_id, p_encounter_id,
          v_drop_source, 'GUARANTEED', v_encounter.tier, v_event_id
        )
      LOOP
        IF v_drop.item_code IS NOT NULL THEN
          v_drops := v_drops || jsonb_build_object(
            'item_code', v_drop.item_code,
            'item_name', v_drop.item_name,
            'rarity', v_drop.rarity,
            'quantity', v_drop.quantity
          );
        END IF;
      END LOOP;

      FOR v_drop IN
        SELECT * FROM public.roll_and_grant_item_drop(
          p_session_id, p_user_id, v_session.game_id, p_encounter_id,
          v_drop_source, 'BONUS', v_encounter.tier, v_event_id
        )
      LOOP
        IF v_drop.item_code IS NOT NULL THEN
          v_drops := v_drops || jsonb_build_object(
            'item_code', v_drop.item_code,
            'item_name', v_drop.item_name,
            'rarity', v_drop.rarity,
            'quantity', v_drop.quantity
          );
        END IF;
      END LOOP;
    ELSE
      FOR v_drop IN
        SELECT * FROM public.roll_and_grant_item_drop(
          p_session_id, p_user_id, v_session.game_id, p_encounter_id,
          v_drop_source, 'SINGLE', v_encounter.tier, v_event_id
        )
      LOOP
        IF v_drop.item_code IS NOT NULL THEN
          v_drops := v_drops || jsonb_build_object(
            'item_code', v_drop.item_code,
            'item_name', v_drop.item_name,
            'rarity', v_drop.rarity,
            'quantity', v_drop.quantity
          );
        END IF;
      END LOOP;
    END IF;
  ELSE
    UPDATE public.game_encounters
    SET current_hp = v_monster_hp
    WHERE id = p_encounter_id;

    SELECT balance INTO v_coin_balance
    FROM public.game_coin_wallets
    WHERE user_id = p_user_id AND game_id = v_session.game_id;
  END IF;

  v_response := jsonb_build_object(
    'won', v_won,
    'round_count', v_round,
    'player_hp', v_player_hp,
    'monster_hp', v_monster_hp,
    'monster', jsonb_build_object(
      'name', v_rule.name,
      'tier', v_encounter.tier,
      'hp', v_rule.base_hp,
      'atk', v_rule.base_atk,
      'def', v_rule.base_def,
      'score', v_rule.base_score
    ),
    'rounds', v_rounds,
    'coin_earned', COALESCE(v_coin_amount, 0),
    'coin_balance', COALESCE(v_coin_balance, 0),
    'drops', v_drops
  );

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_combat(
  uuid, uuid, bigint
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.resolve_combat(
  uuid, uuid, bigint
) FROM anon;

REVOKE ALL ON FUNCTION public.resolve_combat(
  uuid, uuid, bigint
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_combat(
  uuid, uuid, bigint
) TO service_role;

COMMIT;
