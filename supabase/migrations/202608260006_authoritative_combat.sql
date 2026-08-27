-- LOOTFORM Authoritative Combat (MVP)
-- Date: 2026-08-26
--
-- Purpose (STEP 2.8):
--   Close the last combat-forgery gap identified in STEP 2.5/2.7:
--   Player HP / Monster HP / Damage / Monster Defeat were entirely
--   computed client-side (resolveAutoBattle() in
--   app/game/play/page.tsx) and only reported after the fact via a
--   MONSTER_DEFEATED telemetry event. After this migration, the
--   server computes the entire fight and is the one that marks an
--   encounter DEFEATED and records the kill event -- the client
--   can no longer claim a kill it did not earn.
--
-- Audited before writing this file:
--   game_session_state (STEP 2.6/2.7) -> no player HP tracking
--     existed at all; adding player_current_hp here, initialized
--     from the same stats_snapshot Session Start already computes.
--   game_monster_rules -> base_atk/base_def/base_hp/base_score
--     already match the client's MONSTER_STATS exactly (confirmed
--     in STEP 2.7 audit) -- reused as-is.
--   game_encounters (STEP 2.7) -> resolve_encounter_defeat() already
--     does the "mark DEFEATED, one-time" transition; resolve_combat
--     folds that same transition in directly on a real win instead
--     of requiring a second client call, since combat and defeat
--     are now proven by the same server computation.
--
-- MVP scope decision: one resolve_combat() call resolves the WHOLE
-- fight (same round-robin loop the client used to run locally) and
-- returns the full round-by-round result in the exact shape
-- CombatScene already expects, so the battle UI/animation needs
-- ZERO changes -- only where the data comes from changes.
-- Per-round client-driven ATTACK actions were the literal spec
-- wording but would have required rebuilding the combat UI, which
-- conflicts with "do not rewrite working Game UI" -- flagged in the
-- STEP report for the user to redirect if per-round is required.
--
-- Ability effects (BERSERK/FORTIFIED/etc.) are explicitly NOT
-- computed here -- they were never implemented client-side either,
-- so this is not a regression. Flagged as future work.

BEGIN;

ALTER TABLE public.game_session_state
  ADD COLUMN IF NOT EXISTS player_current_hp integer;

COMMENT ON COLUMN public.game_session_state.player_current_hp IS
  'AUTHORITATIVE as of STEP 2.8. Initialized at Session Start from '
  'stats_snapshot.effective.hp, updated only by resolve_combat().';

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

  -- AUTHORITATIVE inputs only: player ATK/DEF from the Session's own
  -- frozen stats_snapshot (STEP 2.6), player HP from
  -- game_session_state (this migration), monster stats from
  -- game_monster_rules. Nothing here comes from the request body.
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
    );
  ELSE
    UPDATE public.game_encounters
    SET current_hp = v_monster_hp
    WHERE id = p_encounter_id;
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
    'rounds', v_rounds
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
