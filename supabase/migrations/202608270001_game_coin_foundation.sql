-- LOOTFORM Game Coin Foundation
-- Date: 2026-08-27
--
-- Purpose (STEP 3):
--   Introduce GAME_COIN, a separate non-tradable gameplay currency.
--   GAME_COIN is never LT. This migration never touches
--   public.wallets / public.wallet_transactions (the LT ledger).
--
-- Audited before writing this file:
--   public.game_coin_wallets and public.game_coin_transactions
--   ALREADY EXIST live on this project (created 2026-08-22, before
--   the STEP 2.6-2.8 security work), but have NO migration file
--   backing them anywhere in this repo -- confirmed via
--   list_migrations vs supabase/migrations/*.sql. This is schema
--   drift: a fresh environment would not have these tables. This
--   migration backfills them with CREATE TABLE IF NOT EXISTS /
--   ADD COLUMN IF NOT EXISTS so it is safe to run against both the
--   live (already-has-them) project and a fresh one, then adds only
--   what STEP 3 actually needs on top.
--
--   Existing game_coin_transactions.transaction_type is already
--   CHECK-constrained to ('EARN','SPEND','ADJUSTMENT') -- the coarse
--   ledger direction. The existing free-text `source` column is
--   where specific reward codes (MONSTER_REWARD / ELITE_REWARD /
--   EXPEDITION_COMPLETE / MISSION_REWARD) belong. This was already
--   correctly separated; reused as-is, not renamed.
--
--   Existing game_coin_wallets only has `balance` -- lifetime_earned
--   and lifetime_spent (required by STEP 3 spec) are added here.
--
--   game_monster_rules.tier has exactly three live values: SCOUT,
--   GUARD, ELITE (no literal "NORMAL"). finalize_game_session already
--   groups SCOUT+GUARD as "monsters_killed" and ELITE separately as
--   "elites_killed" -- the reward config below follows the same
--   grouping: SCOUT/GUARD -> MONSTER_REWARD, ELITE -> ELITE_REWARD.
--
-- Reward settlement points (both already-atomic, already-idempotent
-- for their own primary purpose -- Game Coin rides on top of that
-- existing guarantee instead of adding a new one):
--   resolve_combat()      -- credits MONSTER_REWARD/ELITE_REWARD in
--                            the same transaction as the encounter's
--                            one-time ACTIVE->DEFEATED transition and
--                            the MONSTER_DEFEATED event insert. A
--                            second call against the same encounter
--                            never reaches the win branch again
--                            (ENCOUNTER_NOT_ACTIVE), so it structurally
--                            cannot double-mint.
--   finalize_game_session() -- credits EXPEDITION_COMPLETE only when
--                            p_result = 'COMPLETE', inside the same
--                            function that already returns early
--                            (idempotent_replay = true) if a
--                            game_results row for this session already
--                            exists -- a retried finalize call never
--                            reaches the credit call twice.
--   credit_game_coin()    -- the shared helper both call. It also
--                            attaches the ledger row to the same
--                            game_events.id the caller just inserted
--                            via the existing unique partial index
--                            game_coin_transactions_unique_event_idx
--                            (game_event_id) as a second, independent
--                            idempotency layer: if either guard above
--                            were ever bypassed by a future bug, the
--                            unique index raises and the whole
--                            transaction (including the balance
--                            update) rolls back -- it never silently
--                            no-ops with a mismatched balance.
--
-- Reward amounts are NOT hard-coded in these functions -- they are
-- read from game_coin_reward_rules, a new data-driven config table,
-- per the "do not scatter hard-coded reward values" instruction.

BEGIN;

-- =========================================================
-- 1. BACKFILL EXISTING WALLET/LEDGER SCHEMA
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_coin_wallets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  game_id bigint NOT NULL REFERENCES public.games(id),
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_coin_wallets_user_game_unique UNIQUE (user_id, game_id)
);

CREATE TABLE IF NOT EXISTS public.game_coin_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  game_id bigint NOT NULL REFERENCES public.games(id),
  session_id uuid REFERENCES public.game_sessions(id),
  game_event_id bigint REFERENCES public.game_events(id),
  amount bigint NOT NULL CHECK (amount <> 0),
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('EARN', 'SPEND', 'ADJUSTMENT')),
  source text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS game_coin_transactions_unique_event_idx
  ON public.game_coin_transactions (game_event_id)
  WHERE game_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS game_coin_transactions_user_game_idx
  ON public.game_coin_transactions (user_id, game_id, created_at DESC);

CREATE INDEX IF NOT EXISTS game_coin_transactions_session_idx
  ON public.game_coin_transactions (session_id);

CREATE INDEX IF NOT EXISTS game_coin_transactions_event_idx
  ON public.game_coin_transactions (game_event_id);

CREATE INDEX IF NOT EXISTS game_coin_wallets_user_id_idx
  ON public.game_coin_wallets (user_id);

CREATE INDEX IF NOT EXISTS game_coin_wallets_game_id_idx
  ON public.game_coin_wallets (game_id);

ALTER TABLE public.game_coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_coin_wallets_select_own ON public.game_coin_wallets;
CREATE POLICY game_coin_wallets_select_own
  ON public.game_coin_wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS game_coin_transactions_select_own ON public.game_coin_transactions;
CREATE POLICY game_coin_transactions_select_own
  ON public.game_coin_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- STEP 3: add lifetime_earned / lifetime_spent (not present on the
-- pre-existing live table).
ALTER TABLE public.game_coin_wallets
  ADD COLUMN IF NOT EXISTS lifetime_earned bigint NOT NULL DEFAULT 0;

ALTER TABLE public.game_coin_wallets
  ADD COLUMN IF NOT EXISTS lifetime_spent bigint NOT NULL DEFAULT 0;

ALTER TABLE public.game_coin_wallets
  DROP CONSTRAINT IF EXISTS game_coin_wallets_lifetime_earned_check;

ALTER TABLE public.game_coin_wallets
  ADD CONSTRAINT game_coin_wallets_lifetime_earned_check CHECK (lifetime_earned >= 0);

ALTER TABLE public.game_coin_wallets
  DROP CONSTRAINT IF EXISTS game_coin_wallets_lifetime_spent_check;

ALTER TABLE public.game_coin_wallets
  ADD CONSTRAINT game_coin_wallets_lifetime_spent_check CHECK (lifetime_spent >= 0);

COMMENT ON TABLE public.game_coin_wallets IS
  'GAME_COIN balance per user per game. Non-tradable gameplay currency, '
  'separate from public.wallets (LT). Never written by the client -- '
  'only by credit_game_coin() (SECURITY DEFINER).';

COMMENT ON TABLE public.game_coin_transactions IS
  'Immutable GAME_COIN ledger. transaction_type is the coarse ledger '
  'direction (EARN/SPEND/ADJUSTMENT); `source` holds the specific '
  'reward/spend code (MONSTER_REWARD, ELITE_REWARD, EXPEDITION_COMPLETE, '
  'BOSS_REWARD, MISSION_REWARD, future SHOP_PURCHASE/SHIRT_ENHANCEMENT/'
  'SERVICE_FEE). game_event_id ties an EARN row back to the exact '
  'authoritative game_events row that produced it and doubles as an '
  'idempotency key via game_coin_transactions_unique_event_idx.';

-- =========================================================
-- 2. BETA REWARD CONFIG (data-driven, not hard-coded in functions)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_coin_reward_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id bigint NOT NULL REFERENCES public.games(id),
  source text NOT NULL,
  tier text,
  min_amount integer NOT NULL CHECK (min_amount >= 0),
  max_amount integer NOT NULL CHECK (max_amount >= min_amount),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_coin_reward_rules_unique UNIQUE (game_id, source, tier)
);

COMMENT ON TABLE public.game_coin_reward_rules IS
  'Beta hypothesis reward ranges for GAME_COIN faucets. Read only by '
  'SECURITY DEFINER functions (resolve_combat, finalize_game_session) -- '
  'RLS is enabled with no policies so no client role can read or write '
  'this table directly. Owned by Game Economy / Game Design per '
  '/lootform-growth; adjust values here, never hard-code them in a '
  'function body.';

ALTER TABLE public.game_coin_reward_rules ENABLE ROW LEVEL SECURITY;

INSERT INTO public.game_coin_reward_rules
  (game_id, source, tier, min_amount, max_amount)
SELECT 1, 'MONSTER_REWARD', 'SCOUT', 2, 4
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_coin_reward_rules
  WHERE game_id = 1 AND source = 'MONSTER_REWARD' AND tier = 'SCOUT'
);

INSERT INTO public.game_coin_reward_rules
  (game_id, source, tier, min_amount, max_amount)
SELECT 1, 'MONSTER_REWARD', 'GUARD', 2, 4
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_coin_reward_rules
  WHERE game_id = 1 AND source = 'MONSTER_REWARD' AND tier = 'GUARD'
);

INSERT INTO public.game_coin_reward_rules
  (game_id, source, tier, min_amount, max_amount)
SELECT 1, 'ELITE_REWARD', 'ELITE', 12, 18
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_coin_reward_rules
  WHERE game_id = 1 AND source = 'ELITE_REWARD' AND tier = 'ELITE'
);

INSERT INTO public.game_coin_reward_rules
  (game_id, source, tier, min_amount, max_amount)
SELECT 1, 'EXPEDITION_COMPLETE', NULL, 40, 40
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_coin_reward_rules
  WHERE game_id = 1 AND source = 'EXPEDITION_COMPLETE' AND tier IS NULL
);

-- =========================================================
-- 3. SHARED CREDIT HELPER (EARN-only -- STEP 3 has no sinks yet)
-- =========================================================

CREATE OR REPLACE FUNCTION public.credit_game_coin(
  p_user_id uuid,
  p_game_id bigint,
  p_amount integer,
  p_source text,
  p_session_id uuid,
  p_game_event_id bigint
)
RETURNS TABLE (new_balance bigint, ledger_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.game_coin_wallets%ROWTYPE;
  v_new_balance bigint;
  v_ledger_id bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'GAME_COIN_INVALID_AMOUNT'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.game_coin_wallets (user_id, game_id)
  VALUES (p_user_id, p_game_id)
  ON CONFLICT (user_id, game_id) DO NOTHING;

  SELECT *
  INTO v_wallet
  FROM public.game_coin_wallets
  WHERE user_id = p_user_id AND game_id = p_game_id
  FOR UPDATE;

  v_new_balance := v_wallet.balance + p_amount;

  UPDATE public.game_coin_wallets
  SET
    balance = v_new_balance,
    lifetime_earned = lifetime_earned + p_amount,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- No ON CONFLICT here on purpose: if p_game_event_id was already
  -- used, this must hard-fail and roll back the whole transaction
  -- (including the balance update above) rather than silently
  -- no-op with a mismatched balance.
  INSERT INTO public.game_coin_transactions (
    user_id, game_id, session_id, game_event_id,
    amount, balance_after, transaction_type, source
  )
  VALUES (
    p_user_id, p_game_id, p_session_id, p_game_event_id,
    p_amount, v_new_balance, 'EARN', p_source
  )
  RETURNING id INTO v_ledger_id;

  RETURN QUERY SELECT v_new_balance, v_ledger_id;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_game_coin(
  uuid, bigint, integer, text, uuid, bigint
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.credit_game_coin(
  uuid, bigint, integer, text, uuid, bigint
) FROM anon;

REVOKE ALL ON FUNCTION public.credit_game_coin(
  uuid, bigint, integer, text, uuid, bigint
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.credit_game_coin(
  uuid, bigint, integer, text, uuid, bigint
) TO service_role;

-- =========================================================
-- 4. WIRE INTO resolve_combat() -- MONSTER_REWARD / ELITE_REWARD
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

    -- GAME_COIN reward: read range from data-driven config, never
    -- hard-coded here. tier comes from v_encounter (server-set at
    -- generate_game_encounters time) -- the client cannot claim a
    -- NORMAL kill was an ELITE kill.
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
    'coin_balance', COALESCE(v_coin_balance, 0)
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

-- =========================================================
-- 5. WIRE INTO finalize_game_session() -- EXPEDITION_COMPLETE only
-- =========================================================

CREATE OR REPLACE FUNCTION public.finalize_game_session(
  p_session_id uuid,
  p_user_id uuid,
  p_result text,
  p_explored_tiles integer,
  p_map_total_tiles integer,
  p_fail_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.game_sessions%ROWTYPE;
  v_state public.game_session_state%ROWTYPE;
  v_existing_result public.game_results%ROWTYPE;
  v_result_row public.game_results%ROWTYPE;

  v_now timestamptz := now();

  v_score bigint;
  v_monsters integer;
  v_elites integer;
  v_loot integer;
  v_duration integer;
  v_explored_percent numeric(5, 2);
  v_next_status text;

  v_event_id bigint;
  v_coin_min integer;
  v_coin_max integer;
  v_coin_amount integer := 0;
  v_coin_balance bigint;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'GAME_RESULT_INVALID_SESSION_ID'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'GAME_RESULT_INVALID_USER_ID'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_result NOT IN ('COMPLETE', 'FAIL') THEN
    RAISE EXCEPTION 'GAME_RESULT_INVALID_RESULT'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_result = 'FAIL'
     AND p_fail_reason IS NOT NULL
     AND p_fail_reason NOT IN ('PLAYER_HP_DEPLETED', 'STAMINA_DEPLETED')
  THEN
    RAISE EXCEPTION 'GAME_RESULT_INVALID_FAIL_REASON'
      USING ERRCODE = 'P0001';
  END IF;

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

  SELECT *
  INTO v_existing_result
  FROM public.game_results
  WHERE session_id = p_session_id;

  IF FOUND THEN
    SELECT balance INTO v_coin_balance
    FROM public.game_coin_wallets
    WHERE user_id = p_user_id AND game_id = v_session.game_id;

    RETURN jsonb_build_object(
      'result', to_jsonb(v_existing_result),
      'session', jsonb_build_object(
        'id', v_session.id,
        'status', v_session.status
      ),
      'idempotent_replay', true,
      'coin_earned', 0,
      'coin_balance', COALESCE(v_coin_balance, 0)
    );
  END IF;

  IF v_session.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'GAME_SESSION_NOT_ACTIVE'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_result = 'COMPLETE' THEN
    SELECT *
    INTO v_state
    FROM public.game_session_state
    WHERE session_id = p_session_id;

    IF NOT FOUND OR NOT v_state.exit_reached THEN
      RAISE EXCEPTION 'GAME_OBJECTIVE_NOT_COMPLETE'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT
    COALESCE(SUM(numeric_value), 0)::bigint,

    COUNT(*) FILTER (
      WHERE event_name = 'MONSTER_DEFEATED'
        AND payload ->> 'tier' IN ('SCOUT', 'GUARD')
    ),

    COUNT(*) FILTER (
      WHERE event_name = 'MONSTER_DEFEATED'
        AND payload ->> 'tier' = 'ELITE'
    ),

    COUNT(*) FILTER (
      WHERE event_name = 'TREASURE_FOUND'
    )
  INTO
    v_score,
    v_monsters,
    v_elites,
    v_loot
  FROM public.game_events
  WHERE session_id = p_session_id
    AND event_type = 'CUSTOM';

  v_duration :=
    GREATEST(
      0,
      EXTRACT(
        EPOCH FROM (v_now - v_session.started_at)
      )::integer
    );

  v_explored_percent :=
    CASE
      WHEN p_map_total_tiles IS NOT NULL
        AND p_map_total_tiles > 0
        AND p_explored_tiles IS NOT NULL
      THEN
        ROUND(
          LEAST(
            100,
            GREATEST(
              0,
              p_explored_tiles::numeric
                / p_map_total_tiles
                * 100
            )
          ),
          2
        )
      ELSE NULL
    END;

  v_next_status :=
    CASE
      WHEN p_result = 'COMPLETE' THEN 'COMPLETED'
      ELSE 'FAILED'
    END;

  UPDATE public.game_sessions
  SET
    status = v_next_status,
    completed_at = v_now,
    last_event_at = v_now,
    final_score = v_score
  WHERE id = p_session_id;

  INSERT INTO public.game_results (
    session_id,
    user_id,
    game_id,
    result,
    fail_reason,
    score,
    monsters_killed,
    elites_killed,
    loot_collected,
    explored_tiles,
    explored_percent,
    duration_seconds,
    stats_snapshot,
    started_at,
    completed_at
  )
  VALUES (
    p_session_id,
    p_user_id,
    v_session.game_id,
    p_result,
    p_fail_reason,
    v_score,
    v_monsters,
    v_elites,
    v_loot,
    p_explored_tiles,
    v_explored_percent,
    v_duration,
    v_session.stats_snapshot,
    v_session.started_at,
    v_now
  )
  RETURNING *
  INTO v_result_row;

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
    p_result,
    CASE
      WHEN p_result = 'COMPLETE' THEN 'GRID_EXPEDITION_COMPLETE'
      ELSE COALESCE(p_fail_reason, 'GRID_EXPEDITION_FAILED')
    END,
    v_score,
    jsonb_build_object(
      'source', 'GRID_EXPEDITION',
      'score', v_score,
      'monsters_killed', v_monsters,
      'elites_killed', v_elites,
      'loot_collected', v_loot
    )
  )
  RETURNING id INTO v_event_id;

  -- GAME_COIN completion bonus: COMPLETE only, never on FAIL.
  IF p_result = 'COMPLETE' THEN
    SELECT min_amount, max_amount
    INTO v_coin_min, v_coin_max
    FROM public.game_coin_reward_rules
    WHERE game_id = v_session.game_id
      AND source = 'EXPEDITION_COMPLETE'
      AND tier IS NULL
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
        'EXPEDITION_COMPLETE',
        p_session_id,
        v_event_id
      );
    ELSE
      SELECT balance INTO v_coin_balance
      FROM public.game_coin_wallets
      WHERE user_id = p_user_id AND game_id = v_session.game_id;
    END IF;
  ELSE
    SELECT balance INTO v_coin_balance
    FROM public.game_coin_wallets
    WHERE user_id = p_user_id AND game_id = v_session.game_id;
  END IF;

  RETURN jsonb_build_object(
    'result', to_jsonb(v_result_row),
    'session', jsonb_build_object(
      'id', v_session.id,
      'status', v_next_status
    ),
    'idempotent_replay', false,
    'coin_earned', COALESCE(v_coin_amount, 0),
    'coin_balance', COALESCE(v_coin_balance, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_game_session(
  uuid, uuid, text, integer, integer, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.finalize_game_session(
  uuid, uuid, text, integer, integer, text
) FROM anon;

REVOKE ALL ON FUNCTION public.finalize_game_session(
  uuid, uuid, text, integer, integer, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_game_session(
  uuid, uuid, text, integer, integer, text
) TO service_role;

COMMIT;
