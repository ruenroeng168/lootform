-- LOOTFORM Authoritative Expedition State + Exit Proof
-- Date: 2026-08-26
--
-- Purpose (STEP 2.6):
--   Close the COMPLETE forgery gap found in STEP 2.5: there was no
--   server-side record of player position at all, so a caller could
--   claim COMPLETE on their own ACTIVE session without ever moving.
--
-- Audited before writing this file:
--   app/game/play/page.tsx  -> MAP_SIZE=15, WALLS (fixed Set of 30
--     coordinates), START_X/Y=0,0, EXIT_X/Y=MAP_SIZE-1 -- entirely
--     client-side constants, never random, never sent to the server.
--     Reused verbatim below (WALLS duplicated as a SQL array; kept in
--     sync by comment on both sides -- not a real per-run map seed,
--     since none exists yet. See report for this limitation.
--   game_sessions / finalize_game_session -> no position tracking of
--     any kind existed before this migration.
--
-- This migration is additive only. It does not touch Craft,
-- Collection, Equipment, or the FAIL finalize path.

BEGIN;

-- =========================================================
-- 1. GAME SESSION STATE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_session_state (
  session_id uuid PRIMARY KEY
    REFERENCES public.game_sessions (id)
    ON DELETE CASCADE,

  start_x integer NOT NULL,
  start_y integer NOT NULL,

  exit_x integer NOT NULL,
  exit_y integer NOT NULL,

  current_x integer NOT NULL,
  current_y integer NOT NULL,

  turn_count integer NOT NULL DEFAULT 0,

  -- Not a real random seed yet -- the map has no randomization at
  -- all today (see migration header). Reserved for when map
  -- generation becomes real per-run, so this schema does not need
  -- to change again.
  map_seed text NOT NULL,
  map_version text NOT NULL,

  exit_reached boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_session_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.game_session_state FROM PUBLIC;
REVOKE ALL ON TABLE public.game_session_state FROM anon;
GRANT SELECT ON TABLE public.game_session_state TO authenticated;
GRANT ALL ON TABLE public.game_session_state TO service_role;

DROP POLICY IF EXISTS game_session_state_select_own
  ON public.game_session_state;

CREATE POLICY game_session_state_select_own
  ON public.game_session_state
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_sessions gs
      WHERE gs.id = game_session_state.session_id
        AND gs.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.game_session_state IS
  'AUTHORITATIVE. Server-tracked position/turn/exit-reached for one '
  'Expedition. Written only by resolve_game_move(); the client never '
  'writes current_x/current_y/exit_reached directly.';

-- =========================================================
-- 2. AUTHORITATIVE MOVEMENT (ATOMIC)
--
--    Client sends only session_id + direction. Target tile, bounds
--    check, wall check, position update, turn increment, and exit
--    detection all happen here, server-side. Locking
--    game_session_state FOR UPDATE serializes concurrent move calls
--    for the same session (same technique as lootform_craft_atomic's
--    wallet lock / finalize_game_session's session lock).
-- =========================================================

CREATE OR REPLACE FUNCTION public.resolve_game_move(
  p_session_id uuid,
  p_user_id uuid,
  p_direction text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.game_sessions%ROWTYPE;
  v_state public.game_session_state%ROWTYPE;

  v_map_size CONSTANT integer := 15;

  -- Kept in sync by comment with WALLS in app/game/play/page.tsx.
  -- Same static layout, duplicated because SQL and TypeScript cannot
  -- literally share a constant. Not a secret (already a plain client
  -- constant), so duplication here is a data-consistency concern
  -- only, not a security one.
  v_walls CONSTANT text[] := ARRAY[
    '3,1', '3,2', '3,3',
    '3,5', '3,6',
    '1,4', '2,4',
    '5,2', '6,2', '7,2',
    '6,4', '6,5', '6,6',
    '8,1', '8,2',
    '9,4', '10,4',
    '1,8', '2,8', '3,8',
    '5,8', '6,8',
    '8,7', '8,8',
    '10,7', '10,8', '10,9',
    '4,10', '5,10', '6,10'
  ];

  v_dx integer;
  v_dy integer;
  v_target_x integer;
  v_target_y integer;
  v_blocked boolean := false;
  v_block_reason text;
BEGIN
  IF p_direction NOT IN ('UP', 'DOWN', 'LEFT', 'RIGHT') THEN
    RAISE EXCEPTION 'GAME_MOVE_INVALID_DIRECTION'
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

  UPDATE public.game_sessions
  SET last_event_at = now()
  WHERE id = p_session_id;

  IF v_state.exit_reached THEN
    RETURN jsonb_build_object(
      'state', to_jsonb(v_state),
      'blocked', true,
      'block_reason', 'EXIT_ALREADY_REACHED'
    );
  END IF;

  v_dx :=
    CASE p_direction
      WHEN 'LEFT' THEN -1
      WHEN 'RIGHT' THEN 1
      ELSE 0
    END;

  v_dy :=
    CASE p_direction
      WHEN 'UP' THEN -1
      WHEN 'DOWN' THEN 1
      ELSE 0
    END;

  v_target_x := v_state.current_x + v_dx;
  v_target_y := v_state.current_y + v_dy;

  IF v_target_x < 0
     OR v_target_x >= v_map_size
     OR v_target_y < 0
     OR v_target_y >= v_map_size
  THEN
    v_blocked := true;
    v_block_reason := 'MAP_EDGE';
  ELSIF (v_target_x || ',' || v_target_y) = ANY (v_walls) THEN
    v_blocked := true;
    v_block_reason := 'WALL';
  END IF;

  IF v_blocked THEN
    RETURN jsonb_build_object(
      'state', to_jsonb(v_state),
      'blocked', true,
      'block_reason', v_block_reason
    );
  END IF;

  UPDATE public.game_session_state
  SET
    current_x = v_target_x,
    current_y = v_target_y,
    turn_count = turn_count + 1,
    exit_reached = (
      v_target_x = exit_x
      AND v_target_y = exit_y
    ),
    updated_at = now()
  WHERE session_id = p_session_id
  RETURNING *
  INTO v_state;

  RETURN jsonb_build_object(
    'state', to_jsonb(v_state),
    'blocked', false,
    'block_reason', null
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_game_move(
  uuid, uuid, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.resolve_game_move(
  uuid, uuid, text
) FROM anon;

REVOKE ALL ON FUNCTION public.resolve_game_move(
  uuid, uuid, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_game_move(
  uuid, uuid, text
) TO service_role;

-- =========================================================
-- 3. FINALIZE COMPLETE NOW REQUIRES PROVEN EXIT
--
--    Same signature as STEP 2's finalize_game_session -- additive
--    check only. FAIL path is untouched (still no exit_reached
--    requirement, exactly as it worked before this migration).
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
    STEP 2.6: COMPLETE now requires server-proven exit_reached.
    No game_session_state row at all (older/synthetic sessions from
    before this migration) also fails closed -- treated the same as
    exit not reached.
  */
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

COMMENT ON COLUMN public.game_results.result IS
  'AUTHORITATIVE as of STEP 2.6 for result = COMPLETE (proven by '
  'game_session_state.exit_reached inside finalize_game_session). '
  'FAIL remains a client-initiated request validated only for '
  'ownership + ACTIVE session, same as STEP 2.5.';

COMMIT;
