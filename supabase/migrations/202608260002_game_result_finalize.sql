-- LOOTFORM Game Result + Session Finalization
-- Date: 2026-08-26
--
-- Purpose:
--   Give every Expedition that reaches COMPLETE or FAIL a real,
--   server-authoritative outcome: game_sessions is finalized and a
--   single game_results row is created, atomically, idempotently.
--
-- Audited before writing this file:
--   game_sessions   -> status CHECK already allows COMPLETED/FAILED;
--                      final_score/completed_at columns already exist
--   game_events     -> event_type CHECK already allows COMPLETE/FAIL;
--                      MONSTER_DEFEATED/TREASURE_FOUND CUSTOM events
--                      already carry numeric_value + payload.tier --
--                      used here as the authoritative source for
--                      score / monsters_killed / elites_killed /
--                      loot_collected instead of trusting the client
--   game_results    -> did not exist, created here
--   No session in the current database has ever reached COMPLETED or
--   FAILED -- app/game/play/page.tsx only ever set local React state,
--   it never told the server. That is the gap this migration closes.
--
-- Explicitly NOT built here (per STEP 2 scope): reward, LT, EXP, drop,
-- inventory, potion, shop. score/monsters/elites/loot are Game
-- Performance numbers only and must not feed Collection Score, Global
-- Rank, LT or EXP.

BEGIN;

-- =========================================================
-- 1. GAME RESULTS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  session_id uuid NOT NULL UNIQUE
    REFERENCES public.game_sessions (id)
    ON DELETE CASCADE,

  user_id uuid NOT NULL
    REFERENCES auth.users (id)
    ON DELETE CASCADE,

  game_id bigint NOT NULL
    REFERENCES public.games (id)
    ON DELETE RESTRICT,

  result text NOT NULL
    CHECK (result IN ('COMPLETE', 'FAIL')),

  fail_reason text
    CHECK (
      fail_reason IS NULL
      OR fail_reason IN ('PLAYER_HP_DEPLETED', 'STAMINA_DEPLETED')
    ),

  -- Game Performance only. Never fed into Collection Score, Global
  -- Rank, LT or EXP (STEP 2 explicitly forbids this).
  score bigint NOT NULL DEFAULT 0,

  monsters_killed integer NOT NULL DEFAULT 0,
  elites_killed integer NOT NULL DEFAULT 0,
  loot_collected integer NOT NULL DEFAULT 0,

  -- Client-reported, informational only -- fog-of-war exploration is
  -- not tracked server-side today (no per-tile event exists). Zero
  -- reward consequence, so this is accepted as telemetry, not truth.
  explored_tiles integer,
  explored_percent numeric(5, 2),

  -- Computed server-side from game_sessions.started_at, never trusted
  -- from the client.
  duration_seconds integer,

  -- Copied from the Session's own frozen snapshot, not recomputed.
  stats_snapshot jsonb,

  started_at timestamptz,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_results_user_created_idx
  ON public.game_results (user_id, created_at DESC);

ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.game_results FROM PUBLIC;
REVOKE ALL ON TABLE public.game_results FROM anon;
GRANT SELECT ON TABLE public.game_results TO authenticated;
GRANT ALL ON TABLE public.game_results TO service_role;

DROP POLICY IF EXISTS game_results_select_own
  ON public.game_results;

CREATE POLICY game_results_select_own
  ON public.game_results
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 2. FINALIZE GAME SESSION (ATOMIC, IDEMPOTENT)
--
--    Auth user -> lock Session -> verify ownership -> if a Result
--    already exists for this session, return it unchanged (idempotent
--    replay covers double-click / network retry) -> otherwise verify
--    Session is still ACTIVE -> aggregate score/monsters/elites/loot
--    from game_events (server-recorded, not client-supplied) ->
--    finalize game_sessions -> insert game_results -> insert a
--    COMPLETE/FAIL game_events row for the audit trail.
--
--    Locking game_sessions FOR UPDATE serializes concurrent finalize
--    calls for the same session (same technique as
--    lootform_craft_atomic's wallet row lock), so the idempotency
--    check has no race window.
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
  v_response jsonb;
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

  /*
    Lock the Session row. This is the same choke point Session Start
    already treats as the source of truth, and it makes the
    idempotency check below race-free.
  */
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

  /*
    IDEMPOTENCY
    A Result already exists for this Session -> return the original,
    committed Result. Covers double-click and network retry without
    ever creating a second row (also enforced by UNIQUE(session_id)
    as a database-level backstop).
  */
  SELECT *
  INTO v_existing_result
  FROM public.game_results
  WHERE session_id = p_session_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'result', to_jsonb(v_existing_result),
      'session', jsonb_build_object(
        'id', v_session.id,
        'status', v_session.status
      ),
      'idempotent_replay', true
    );
  END IF;

  IF v_session.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'GAME_SESSION_NOT_ACTIVE'
      USING ERRCODE = 'P0001';
  END IF;

  /*
    AUTHORITATIVE AGGREGATION
    score / monsters_killed / elites_killed / loot_collected come from
    game_events already recorded by the server during this Session --
    never from a client-submitted total.
  */
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
  );

  RETURN jsonb_build_object(
    'result', to_jsonb(v_result_row),
    'session', jsonb_build_object(
      'id', v_session.id,
      'status', v_next_status
    ),
    'idempotent_replay', false
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
