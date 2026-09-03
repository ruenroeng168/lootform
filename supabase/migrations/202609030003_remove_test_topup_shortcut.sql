-- LOOTFORM: remove the test top-up auto-credit shortcut entirely
-- Date: 2026-09-03
--
-- Per product decision: all top-ups must go through the existing
-- manual Admin review flow (see 202608252000_manual_topup_review.sql --
-- topup_review_atomic, app/api/admin/topup/orders/review/route.ts).
-- The dev-only "TEST TOP-UP +100 LT" self-serve shortcut
-- (complete_test_topup(), called from app/api/wallet/topup/test/route.ts)
-- bypassed that review entirely, so it is being removed as a feature,
-- not just access-restricted.
--
-- Companion changes in the same commit:
--   - deleted app/api/wallet/topup/test/route.ts
--   - removed the "DEV / TEST ONLY" button + testTopup() logic from
--     app/wallet/topup/page.tsx
--
-- NOT YET APPLIED to the live project -- saved locally for review/testing.

BEGIN;

DROP FUNCTION IF EXISTS public.complete_test_topup(uuid, text, text, integer, integer);

COMMIT;
