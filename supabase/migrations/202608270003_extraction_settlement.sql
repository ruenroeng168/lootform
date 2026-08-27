-- LOOTFORM Authoritative Extraction Settlement (STEP 4C)
-- Date: 2026-08-27
--
-- Purpose:
--   The first real risk/reward loop. Session UNEXTRACTED loot
--   (STEP 4B) settles atomically inside the same trusted transaction
--   as finalize_game_session():
--     COMPLETE (proven by exit_reached, STEP 2.6) -> EXTRACTED,
--       credited into permanent player_game_inventory.
--     FAIL -> LOST. Permanent inventory untouched.
--   GAME_COIN and LT are both completely unaffected by this
--   migration -- GAME_COIN keeps its existing STEP 3 behavior
--   (already implemented, not touched here beyond leaving it as-is),
--   LT is never referenced anywhere in this file.
--
-- Audited before writing this file:
--   finalize_game_session() already has exactly the guard this needs
--   for "no double extraction": it returns early
--   (idempotent_replay = true) the moment a game_results row already
--   exists for the session, before reaching any new code added here.
--   A retried/duplicate finalize call therefore never re-executes
--   the extraction block twice -- the same guard STEP 3 already
--   relies on for GAME_COIN.
--
--   No inventory ledger table exists anywhere in this project.
--   Creating game_inventory_transactions now, mirroring the
--   game_coin_transactions pattern (STEP 3): immutable, RLS
--   SELECT-own-only, and a unique constraint on
--   (transaction_type, source_id) so one settled loot row can credit
--   inventory at most once -- the same "structural guard + unique
--   index backstop" doctrine used throughout this project.
--
--   game_session_loot.status already supports
--   UNEXTRACTED/EXTRACTED/LOST (STEP 4B) -- reused as-is. Adding
--   settled_at as the one useful missing timestamp.
--
--   Known, accepted gap (out of this STEP's scope): a session
--   abandoned by starting a new one (game_sessions.status set
--   directly to ABANDONED in the Session Start route) never calls
--   finalize_game_session, so its UNEXTRACTED loot is left neither
--   EXTRACTED nor LOST. Not created or fixed here -- flagged in the
--   STEP report.

BEGIN;

-- =========================================================
-- 1. game_session_loot: settlement timestamp
-- =========================================================

ALTER TABLE public.game_session_loot
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;

COMMENT ON COLUMN public.game_session_loot.status IS
  'UNEXTRACTED (default) -> EXTRACTED (COMPLETE) or LOST (FAIL). '
  'Both transitions happen only inside extract_session_loot() '
  '(SECURITY DEFINER, called from finalize_game_session), gated by '
  '`WHERE status = ''UNEXTRACTED''` so a row already settled can '
  'never move again (EXTRACTED/LOST are terminal).';

-- =========================================================
-- 2. PERMANENT INVENTORY LEDGER (immutable, auditable --
--    Marketplace-ready per /lootform-growth)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_inventory_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  item_definition_id bigint NOT NULL REFERENCES public.game_item_definitions(id),
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('EXTRACTION')),
  source_type text NOT NULL,
  source_id bigint,
  session_id uuid REFERENCES public.game_sessions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.game_inventory_transactions IS
  'Immutable permanent-inventory ledger. Initial transaction_type is '
  'EXTRACTION only (STEP 4C) -- future Marketplace/Shop/Enhancement '
  'types will extend the CHECK, never bypass this table. source_id '
  'is the settled game_session_loot.id; the unique index on '
  '(transaction_type, source_id) makes each settled loot row credit '
  'inventory at most once. Never written by the client.';

CREATE UNIQUE INDEX IF NOT EXISTS game_inventory_transactions_unique_source_idx
  ON public.game_inventory_transactions (transaction_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS game_inventory_transactions_user_idx
  ON public.game_inventory_transactions (user_id, created_at DESC);

ALTER TABLE public.game_inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_inventory_transactions_select_own
  ON public.game_inventory_transactions;

CREATE POLICY game_inventory_transactions_select_own
  ON public.game_inventory_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 3. EXTRACTION SETTLEMENT HELPER (SECURITY DEFINER)
--
-- Called once from finalize_game_session(), already inside its
-- FOR UPDATE lock on game_sessions and already past its
-- idempotent-replay guard. Settles every currently UNEXTRACTED loot
-- row for this session -- never rerolls, never reads anything the
-- client sent.
-- =========================================================

CREATE OR REPLACE FUNCTION public.extract_session_loot(
  p_session_id uuid,
  p_user_id uuid,
  p_result text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loot record;
  v_items jsonb := '[]'::jsonb;
  v_new_balance bigint;
BEGIN
  IF p_result NOT IN ('COMPLETE', 'FAIL') THEN
    RAISE EXCEPTION 'EXTRACTION_INVALID_RESULT'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_loot IN
    SELECT
      l.id,
      l.item_definition_id,
      l.quantity,
      d.code,
      d.name,
      d.rarity
    FROM public.game_session_loot l
    JOIN public.game_item_definitions d
      ON d.id = l.item_definition_id
    WHERE l.session_id = p_session_id
      AND l.user_id = p_user_id
      AND l.status = 'UNEXTRACTED'
    ORDER BY l.id
  LOOP
    IF p_result = 'COMPLETE' THEN
      INSERT INTO public.player_game_inventory (
        user_id, item_definition_id, quantity, updated_at
      )
      VALUES (
        p_user_id, v_loot.item_definition_id, v_loot.quantity, now()
      )
      ON CONFLICT (user_id, item_definition_id)
      DO UPDATE SET
        quantity = public.player_game_inventory.quantity + v_loot.quantity,
        updated_at = now()
      RETURNING quantity INTO v_new_balance;

      INSERT INTO public.game_inventory_transactions (
        user_id, item_definition_id, quantity_delta, balance_after,
        transaction_type, source_type, source_id, session_id
      )
      VALUES (
        p_user_id, v_loot.item_definition_id, v_loot.quantity, v_new_balance,
        'EXTRACTION', 'RUN_LOOT_EXTRACTION', v_loot.id, p_session_id
      );

      UPDATE public.game_session_loot
      SET status = 'EXTRACTED', settled_at = now()
      WHERE id = v_loot.id
        AND status = 'UNEXTRACTED';
    ELSE
      UPDATE public.game_session_loot
      SET status = 'LOST', settled_at = now()
      WHERE id = v_loot.id
        AND status = 'UNEXTRACTED';
    END IF;

    v_items := v_items || jsonb_build_object(
      'item_code', v_loot.code,
      'item_name', v_loot.name,
      'rarity', v_loot.rarity,
      'quantity', v_loot.quantity
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status',
    CASE WHEN p_result = 'COMPLETE' THEN 'EXTRACTED' ELSE 'LOST' END,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.extract_session_loot(
  uuid, uuid, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.extract_session_loot(
  uuid, uuid, text
) FROM anon;

REVOKE ALL ON FUNCTION public.extract_session_loot(
  uuid, uuid, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.extract_session_loot(
  uuid, uuid, text
) TO service_role;

-- =========================================================
-- 4. WIRE INTO finalize_game_session() -- settle once, in the same
--    transaction, right after GAME_COIN.
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

  v_extraction jsonb;
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

    -- Idempotent replay: report the loot's ALREADY-settled state
    -- from the database, never recompute or reroll it.
    SELECT jsonb_build_object(
      'status',
      COALESCE(
        (
          SELECT l.status
          FROM public.game_session_loot l
          WHERE l.session_id = p_session_id
          LIMIT 1
        ),
        CASE WHEN v_existing_result.result = 'COMPLETE' THEN 'EXTRACTED' ELSE 'LOST' END
      ),
      'items',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'item_code', d.code,
              'item_name', d.name,
              'rarity', d.rarity,
              'quantity', l.quantity
            )
          )
          FROM public.game_session_loot l
          JOIN public.game_item_definitions d ON d.id = l.item_definition_id
          WHERE l.session_id = p_session_id
            AND l.status <> 'UNEXTRACTED'
        ),
        '[]'::jsonb
      )
    )
    INTO v_extraction;

    RETURN jsonb_build_object(
      'result', to_jsonb(v_existing_result),
      'session', jsonb_build_object(
        'id', v_session.id,
        'status', v_session.status
      ),
      'idempotent_replay', true,
      'coin_earned', 0,
      'coin_balance', COALESCE(v_coin_balance, 0),
      'extraction', v_extraction
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

  -- EXTRACTION SETTLEMENT (STEP 4C). Same transaction, same
  -- FOR UPDATE lock on game_sessions, same one-shot guarantee this
  -- whole function already has via the idempotent-replay check above.
  v_extraction :=
    public.extract_session_loot(
      p_session_id,
      p_user_id,
      p_result
    );

  RETURN jsonb_build_object(
    'result', to_jsonb(v_result_row),
    'session', jsonb_build_object(
      'id', v_session.id,
      'status', v_next_status
    ),
    'idempotent_replay', false,
    'coin_earned', COALESCE(v_coin_amount, 0),
    'coin_balance', COALESCE(v_coin_balance, 0),
    'extraction', v_extraction
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
