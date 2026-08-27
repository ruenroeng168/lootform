-- LOOTFORM Authoritative Encounter System
-- Date: 2026-08-26
--
-- Purpose (STEP 2.7):
--   Close the MONSTER_DEFEATED / ELITE forgery gap found in the
--   STEP 2.6 report: Monster/Elite existence, position and tier were
--   entirely client-generated (createEntities() in
--   app/game/play/page.tsx, Math.random()) with zero server record.
--   A client could report defeating a monster that never existed.
--
-- Audited before writing this file:
--   game_monster_rules -> base_hp already matches the client's
--     MONSTER_STATS exactly (SCOUT 38, GUARD 65, ELITE 95) -- reused
--     as-is, not re-hardcoded a third time.
--   game_session_state / resolve_game_move (STEP 2.6) -> already the
--     authority for position/turn/exit. This migration extends the
--     same function rather than creating a parallel movement path.
--   No game_encounters-style table existed before this migration.
--   Wall layout was duplicated twice already (client TS + STEP 2.6
--     resolve_game_move) -- pulled into one grid_expedition_walls()
--     SQL function here so a third copy is not needed.
--
-- Combat itself (damage/HP) is explicitly NOT moved server-side in
-- this migration -- that is STEP 2.8. MONSTER_DEFEATED remains
-- TELEMETRY_ONLY; this migration only makes sure a real, unique,
-- server-owned Monster exists behind every claimed kill.

BEGIN;

-- =========================================================
-- 1. SHARED MAP CONSTANTS (DEDUPLICATED)
--
--    Both resolve_game_move (STEP 2.6) and the new encounter
--    generator need the same wall layout. Previously duplicated
--    inline in resolve_game_move only; centralized here so nothing
--    needs a third copy. Still kept in sync with
--    app/game/play/page.tsx's WALLS constant by comment only (no
--    secret to leak -- see STEP 2.6 report).
-- =========================================================

CREATE OR REPLACE FUNCTION public.grid_expedition_map_size()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 15;
$$;

CREATE OR REPLACE FUNCTION public.grid_expedition_walls()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
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
$$;

REVOKE ALL ON FUNCTION public.grid_expedition_map_size() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grid_expedition_walls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grid_expedition_map_size() TO service_role;
GRANT EXECUTE ON FUNCTION public.grid_expedition_walls() TO service_role;

-- =========================================================
-- 2. GAME ENCOUNTERS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.game_encounters (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  session_id uuid NOT NULL
    REFERENCES public.game_sessions (id)
    ON DELETE CASCADE,

  -- Same domain as game_monster_rules.tier -- an encounter IS a
  -- monster of this tier. This is the "encounter_type = ELITE"
  -- property the spec asks for.
  tier text NOT NULL
    CHECK (tier IN ('SCOUT', 'GUARD', 'ELITE')),

  monster_code text NOT NULL,

  x integer NOT NULL,
  y integer NOT NULL,

  max_hp integer NOT NULL,
  current_hp integer NOT NULL,

  status text NOT NULL DEFAULT 'AVAILABLE'
    CHECK (
      status IN (
        'AVAILABLE',
        'ACTIVE',
        'DEFEATED',
        'SKIPPED'
      )
    ),

  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS game_encounters_session_idx
  ON public.game_encounters (session_id);

-- One encounter per tile per session -- also prevents the generator
-- from ever double-placing two monsters on the same tile.
CREATE UNIQUE INDEX IF NOT EXISTS game_encounters_session_tile_idx
  ON public.game_encounters (session_id, x, y);

ALTER TABLE public.game_encounters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.game_encounters FROM PUBLIC;
REVOKE ALL ON TABLE public.game_encounters FROM anon;
GRANT SELECT ON TABLE public.game_encounters TO authenticated;
GRANT ALL ON TABLE public.game_encounters TO service_role;

DROP POLICY IF EXISTS game_encounters_select_own
  ON public.game_encounters;

CREATE POLICY game_encounters_select_own
  ON public.game_encounters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_sessions gs
      WHERE gs.id = game_encounters.session_id
        AND gs.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.game_encounters IS
  'AUTHORITATIVE existence/id/type/position/status. Written only by '
  'generate_game_encounters() and resolve_game_move()/'
  'resolve_encounter_defeat(). Damage/HP changes are NOT yet '
  'server-verified (STEP 2.8) -- current_hp exists for future use '
  'but this STEP only ever sets it to max_hp or leaves it untouched.';

-- =========================================================
-- 3. ENCOUNTER GENERATION (SERVER-OWNED)
--
--    Called once from Session Start. Picks random walkable,
--    non-start/exit, non-wall tiles and assigns a weighted-random
--    tier -- same distribution the client's randomMonsterTier()
--    already used (50% SCOUT / 35% GUARD / 15% ELITE), so gameplay
--    feel is unchanged. Client can no longer invent monsters.
-- =========================================================

CREATE OR REPLACE FUNCTION public.generate_game_encounters(
  p_session_id uuid,
  p_user_id uuid,
  p_count integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.game_sessions%ROWTYPE;
  v_state public.game_session_state%ROWTYPE;

  v_map_size CONSTANT integer := public.grid_expedition_map_size();
  v_walls CONSTANT text[] := public.grid_expedition_walls();

  v_x integer;
  v_y integer;
  v_roll numeric;
  v_tier text;
  v_rule record;
  v_placed integer := 0;
  v_attempts integer := 0;

  v_encounters jsonb := '[]'::jsonb;
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

  SELECT *
  INTO v_state
  FROM public.game_session_state
  WHERE session_id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAME_SESSION_STATE_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency: never place a second batch on top of an existing
  -- one for the same session (e.g. an accidental retry).
  IF EXISTS (
    SELECT 1
    FROM public.game_encounters
    WHERE session_id = p_session_id
  ) THEN
    SELECT jsonb_agg(to_jsonb(e))
    INTO v_encounters
    FROM public.game_encounters e
    WHERE e.session_id = p_session_id;

    RETURN jsonb_build_object(
      'encounters', COALESCE(v_encounters, '[]'::jsonb),
      'idempotent_replay', true
    );
  END IF;

  WHILE v_placed < p_count
        AND v_attempts < 200
  LOOP
    v_attempts := v_attempts + 1;

    v_x := floor(random() * v_map_size)::integer;
    v_y := floor(random() * v_map_size)::integer;

    IF v_x = v_state.start_x AND v_y = v_state.start_y THEN
      CONTINUE;
    END IF;

    IF v_x = v_state.exit_x AND v_y = v_state.exit_y THEN
      CONTINUE;
    END IF;

    IF (v_x || ',' || v_y) = ANY (v_walls) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.game_encounters
      WHERE session_id = p_session_id
        AND x = v_x
        AND y = v_y
    ) THEN
      CONTINUE;
    END IF;

    v_roll := random();

    v_tier :=
      CASE
        WHEN v_roll < 0.50 THEN 'SCOUT'
        WHEN v_roll < 0.85 THEN 'GUARD'
        ELSE 'ELITE'
      END;

    SELECT code, base_hp
    INTO v_rule
    FROM public.game_monster_rules
    WHERE game_id = v_session.game_id
      AND tier = v_tier
      AND is_boss = false
      AND is_active = true
    ORDER BY sort_order
    LIMIT 1;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO public.game_encounters (
      session_id,
      tier,
      monster_code,
      x,
      y,
      max_hp,
      current_hp,
      status
    )
    VALUES (
      p_session_id,
      v_tier,
      v_rule.code,
      v_x,
      v_y,
      v_rule.base_hp,
      v_rule.base_hp,
      'AVAILABLE'
    );

    v_placed := v_placed + 1;
  END LOOP;

  SELECT jsonb_agg(to_jsonb(e))
  INTO v_encounters
  FROM public.game_encounters e
  WHERE e.session_id = p_session_id;

  RETURN jsonb_build_object(
    'encounters', COALESCE(v_encounters, '[]'::jsonb),
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_game_encounters(
  uuid, uuid, integer
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.generate_game_encounters(
  uuid, uuid, integer
) FROM anon;

REVOKE ALL ON FUNCTION public.generate_game_encounters(
  uuid, uuid, integer
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.generate_game_encounters(
  uuid, uuid, integer
) TO service_role;

-- =========================================================
-- 4. RESOLVE ENCOUNTER DEFEAT (ATOMIC, ONE-TIME)
--
--    Called from /api/game/event when a MONSTER_DEFEATED event
--    arrives with an encounter_id. Locks the encounter row so two
--    concurrent "defeat" calls for the same encounter cannot both
--    succeed. Combat itself (was the fight actually won) is still
--    not verified here -- that is STEP 2.8 -- this only guarantees
--    the encounter existed, belonged to this session, was ACTIVE,
--    and can only ever be consumed once.
-- =========================================================

CREATE OR REPLACE FUNCTION public.resolve_encounter_defeat(
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
  v_encounter public.game_encounters%ROWTYPE;
  v_now timestamptz := now();
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

  UPDATE public.game_encounters
  SET
    status = 'DEFEATED',
    current_hp = 0,
    resolved_at = v_now
  WHERE id = p_encounter_id
  RETURNING *
  INTO v_encounter;

  RETURN to_jsonb(v_encounter);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_encounter_defeat(
  uuid, uuid, bigint
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.resolve_encounter_defeat(
  uuid, uuid, bigint
) FROM anon;

REVOKE ALL ON FUNCTION public.resolve_encounter_defeat(
  uuid, uuid, bigint
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_encounter_defeat(
  uuid, uuid, bigint
) TO service_role;

-- =========================================================
-- 5. resolve_game_move -- ENCOUNTER-AWARE (STEP 2.7)
--
--    Same signature as STEP 2.6. Adds:
--    a) If an ACTIVE encounter already exists for this session,
--       reject the move outright (must resolve it first).
--    b) If the move lands on a tile with an AVAILABLE encounter,
--       activate it (AVAILABLE -> ACTIVE) and return it.
--    Uses the shared grid_expedition_walls()/map_size() functions
--    from section 1 instead of an inline duplicate.
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
  v_active_encounter public.game_encounters%ROWTYPE;
  v_triggered_encounter public.game_encounters%ROWTYPE;

  v_map_size CONSTANT integer := public.grid_expedition_map_size();
  v_walls CONSTANT text[] := public.grid_expedition_walls();

  v_dx integer;
  v_dy integer;
  v_target_x integer;
  v_target_y integer;
  v_blocked boolean := false;
  v_block_reason text;
  v_has_triggered_encounter boolean := false;
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
      'block_reason', 'EXIT_ALREADY_REACHED',
      'encounter', null
    );
  END IF;

  /*
    STEP 2.7: cannot move while an encounter is unresolved.
    Defense in depth -- the client already blocks this locally via
    activeBattle, this is the server-side backstop.
  */
  SELECT *
  INTO v_active_encounter
  FROM public.game_encounters
  WHERE session_id = p_session_id
    AND status = 'ACTIVE'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'state', to_jsonb(v_state),
      'blocked', true,
      'block_reason', 'ENCOUNTER_ACTIVE',
      'encounter', to_jsonb(v_active_encounter)
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
      'block_reason', v_block_reason,
      'encounter', null
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

  /*
    STEP 2.7: landing on an AVAILABLE encounter activates it.
    Only one encounter can ever be ACTIVE at a time per session
    (enforced by the ACTIVE check above on the next move call, and
    by there being no other code path that sets ACTIVE).
  */
  SELECT *
  INTO v_triggered_encounter
  FROM public.game_encounters
  WHERE session_id = p_session_id
    AND x = v_target_x
    AND y = v_target_y
    AND status = 'AVAILABLE'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.game_encounters
    SET
      status = 'ACTIVE',
      started_at = now()
    WHERE id = v_triggered_encounter.id
    RETURNING *
    INTO v_triggered_encounter;

    v_has_triggered_encounter := true;
  END IF;

  RETURN jsonb_build_object(
    'state', to_jsonb(v_state),
    'blocked', false,
    'block_reason', null,
    'encounter',
      CASE
        WHEN v_has_triggered_encounter
        THEN to_jsonb(v_triggered_encounter)
        ELSE null
      END
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

COMMIT;
