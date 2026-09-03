-- LOOTFORM RPG Maker: bound the exp column on rpgmaker_player_state
-- Date: 2026-09-03
--
-- Context:
--   202609010001_rpgmaker_player_state.sql already bounds class_id
--   (CHECK 1-4) and level (CHECK 1-30) for this client-writable PVP
--   opponent-matching table -- see that file's header comment for the
--   accepted trust model (cosmetic display metadata only, not economy).
--
--   exp was left unbounded. The game's own leveling curve
--   (Classes.json expParams [30,20,30,30], maxLevel 30) requires
--   ~131,711 exp to reach level 30. This CHECK gives generous headroom
--   above that (in case the curve is retuned later) while still
--   rejecting negative values or obviously injected garbage (e.g. a
--   player setting exp to 999999999 via a direct client call).
--
-- NOT YET APPLIED to the live project -- saved locally for review/testing.

BEGIN;

ALTER TABLE public.rpgmaker_player_state
  ADD CONSTRAINT rpgmaker_player_state_exp_check
  CHECK (exp BETWEEN 0 AND 1000000);

COMMIT;
