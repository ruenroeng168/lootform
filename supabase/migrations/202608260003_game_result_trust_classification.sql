-- LOOTFORM Game Result Trust Classification
-- Date: 2026-08-26
--
-- Purpose:
--   STEP 2.5 security audit found that game_results.score /
--   monsters_killed / elites_killed / loot_collected are aggregated
--   from game_events whose EXISTENCE and COUNT are entirely
--   client-reported (no server-side encounter/position tracking
--   exists yet -- see audit report for detail). "Recorded via a
--   server endpoint" was being read as "server-verified", which is
--   false. This migration embeds the AUTHORITATIVE vs TELEMETRY_ONLY
--   classification as column comments so it survives independent of
--   any one report, and any future Reward System (STEP 3+) reading
--   this schema directly sees the trust boundary.
--
-- Zero behavior change: comments only.

BEGIN;

COMMENT ON TABLE public.game_results IS
  'Per-Expedition outcome. Some columns are server-authoritative, '
  'some are client-reported telemetry only -- see individual column '
  'comments. Do not treat "exists in this table" as "safe to reward".';

COMMENT ON COLUMN public.game_results.session_id IS
  'AUTHORITATIVE. Verified against game_sessions ownership inside '
  'finalize_game_session.';

COMMENT ON COLUMN public.game_results.user_id IS
  'AUTHORITATIVE. From the authenticated caller, never from request '
  'body.';

COMMENT ON COLUMN public.game_results.result IS
  'PARTIALLY AUTHORITATIVE. FAIL is a reasonable client-initiated '
  'request (validated: ownership + ACTIVE session only). COMPLETE is '
  'NOT currently verified against any server-side game state (no '
  'position/objective tracking exists) -- a caller can claim COMPLETE '
  'on their own ACTIVE session without having played. Do not use '
  'result = COMPLETE alone as proof of a real completion until a '
  'server-verified completion condition exists (see audit report).';

COMMENT ON COLUMN public.game_results.fail_reason IS
  'CLIENT-REPORTED, ENUM-CONSTRAINED. Descriptive only, no reward '
  'consequence.';

COMMENT ON COLUMN public.game_results.score IS
  'TELEMETRY_ONLY. Sum of numeric_value across this session''s '
  'game_events. As of STEP 2.5, MONSTER_DEFEATED values are validated '
  'against game_monster_rules.base_score and TREASURE_FOUND is capped '
  'at a hardcoded plausible range, but the NUMBER of events is still '
  'entirely client-reported (no per-encounter server state exists). '
  'Must not be used by a Reward System without a real encounter-count '
  'proof.';

COMMENT ON COLUMN public.game_results.monsters_killed IS
  'TELEMETRY_ONLY. Same event-count caveat as score.';

COMMENT ON COLUMN public.game_results.elites_killed IS
  'TELEMETRY_ONLY. Same event-count caveat as score.';

COMMENT ON COLUMN public.game_results.loot_collected IS
  'TELEMETRY_ONLY. Same event-count caveat as score.';

COMMENT ON COLUMN public.game_results.explored_tiles IS
  'TELEMETRY_ONLY. No per-tile server event exists. Display use only.';

COMMENT ON COLUMN public.game_results.explored_percent IS
  'TELEMETRY_ONLY. Derived from explored_tiles.';

COMMENT ON COLUMN public.game_results.duration_seconds IS
  'AUTHORITATIVE. Computed server-side from game_sessions.started_at '
  'and now(), never from client input.';

COMMENT ON COLUMN public.game_results.stats_snapshot IS
  'AUTHORITATIVE. Copied unchanged from game_sessions.stats_snapshot, '
  'itself computed server-side at Session Start from real equipped '
  'item snapshots.';

COMMENT ON COLUMN public.game_results.started_at IS
  'AUTHORITATIVE. Copied from game_sessions.started_at (server clock '
  'at session creation).';

COMMENT ON COLUMN public.game_results.completed_at IS
  'AUTHORITATIVE. Server clock at finalize time.';

COMMIT;
