-- LOOTFORM GO-LIVE RESET
--
-- Run this ONCE, manually, in the Supabase SQL Editor, when demo/testing
-- is finished and you are ready to open the real (LIVE) drop.
--
-- ⚠ THIS PERMANENTLY DELETES DEMO DATA. There is no undo.
-- Take a Supabase backup/snapshot before running this if in doubt.
--
-- This is NOT a schema migration (nothing in supabase/migrations/ depends
-- on it, and it is never applied automatically) — it is a one-time data
-- reset you trigger yourself, on purpose, at go-live.
--
-- What this does:
--   1. Deletes everything that references an Item (equipment slots,
--      the legacy "equipped_item_id" field, ledger rows) so Items can
--      be deleted cleanly.
--   2. Deletes every crafted Item (all demo drops).
--   3. Resets every Wallet balance to 0 (the wallet ROW itself is kept,
--      just its balance is cleared — player accounts are untouched).
--   4. Deletes all Top-up Orders (TEST top-ups and any demo real
--      requests).
--   5. Deletes all Craft idempotency records (safe — these only exist
--      to make retried Craft requests safe, not as permanent history).
--   6. Resets the TEE (shirt) serial pool (1-1000) back to fully
--      unused, so the first 1000 LIVE shirts get fresh, non-sequential
--      serials again.
--   7. Restarts the general item serial sequence back to 1, so the
--      next non-TEE item crafted gets serial 0001 again.
--   8. Switches the system into LIVE mode. /api/wallet/topup/test
--      immediately starts rejecting requests (TEST_TOPUP_DISABLED)
--      once this runs, and the "TEST TOP-UP" button on the player
--      page hides itself automatically on next load.
--
-- NOT touched by this script (on purpose):
--   - auth.users (player accounts / login)
--   - player_profiles (level, exp, title, avatar) — reset these
--     yourself first if you also want a fresh player progression
--     state; not included here since that wasn't part of the request
--     this script was written for.
--   - topup_settings / topup_packages (your configured bank/QR/rate
--     and packages) — these are real Admin configuration, not demo
--     data, so they're left as you set them up.
--   - game_sessions / game_events — out of scope for this reset.

BEGIN;

-- 1. Clear everything that references an Item before deleting Items.
UPDATE public.player_profiles SET equipped_item_id = NULL;
DELETE FROM public.player_equipment;
DELETE FROM public.wallet_transactions;

-- 2. Delete every crafted Item.
DELETE FROM public.items;

-- 3. Reset every Wallet to 0 (row kept, balance cleared).
UPDATE public.wallets SET balance = 0, updated_at = now();

-- 4. Clear Top-up order history (TEST + demo).
DELETE FROM public.topup_orders;

-- 5. Clear Craft idempotency records.
DELETE FROM public.craft_requests;

-- 6. Reset the TEE serial pool back to fully unused.
UPDATE public.lootform_tee_serial_pool
SET is_used = false, item_id = NULL, used_at = NULL;

-- 7. Restart the general item serial sequence back to 1.
ALTER SEQUENCE public.lootform_item_serial_seq RESTART WITH 1;

-- 8. Switch the system into LIVE mode.
UPDATE public.system_settings
SET environment_mode = 'LIVE', updated_at = now()
WHERE id = 1;

COMMIT;
