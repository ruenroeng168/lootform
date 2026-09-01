-- LOOTFORM RPG Maker: player state table for Async PVP opponent matching
-- Date: 2026-09-01
--
-- Purpose:
--   The standalone RPG Maker MV game (D:\Games\LOOTFORM) has no server of
--   its own -- class choice and level currently live only in each
--   player's own browser (localStorage / RPG Maker's own save file), so
--   no other player can see them. Async PVP needs to fetch an opponent's
--   class + level (their equipped items are already readable via the
--   existing items/player_equipment RLS policies, no new table needed
--   for those).
--
--   This table is written by the client (LootformBridge plugin) whenever
--   the player's class/level changes -- same trust model already
--   accepted for this standalone game's local Enhancement/Craft-option
--   stats: class/level here are cosmetic gameplay metadata for PVP
--   matching only, not a source of real value, so client-reported data
--   is acceptable (mirrors the "local game state, doesn't touch real
--   economy" precedent from the Enhancement system this session).
--
--   display_name is duplicated here (rather than joined against
--   player_profiles) because player_profiles.display_name is RLS-scoped
--   to the owner only -- a player must explicitly have this row (i.e.
--   have played this game) to be visible to PVP opponent matching at
--   all, so this is opt-in exposure, not a new public leak.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rpgmaker_player_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  class_id integer NOT NULL CHECK (class_id BETWEEN 1 AND 4),
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 30),
  exp integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rpgmaker_player_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rpgmaker_player_state FROM PUBLIC;
REVOKE ALL ON TABLE public.rpgmaker_player_state FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.rpgmaker_player_state TO authenticated;
GRANT ALL ON TABLE public.rpgmaker_player_state TO service_role;

-- Any signed-in player can see the (non-sensitive) class/level/name of
-- every other player who has opted in by playing this game -- required
-- for random PVP opponent matching.
DROP POLICY IF EXISTS rpgmaker_player_state_read_all
  ON public.rpgmaker_player_state;
CREATE POLICY rpgmaker_player_state_read_all
  ON public.rpgmaker_player_state
  FOR SELECT
  TO authenticated
  USING (true);

-- A player can only ever create/update their OWN row.
DROP POLICY IF EXISTS rpgmaker_player_state_write_own
  ON public.rpgmaker_player_state;
CREATE POLICY rpgmaker_player_state_write_own
  ON public.rpgmaker_player_state
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS rpgmaker_player_state_update_own
  ON public.rpgmaker_player_state;
CREATE POLICY rpgmaker_player_state_update_own
  ON public.rpgmaker_player_state
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
