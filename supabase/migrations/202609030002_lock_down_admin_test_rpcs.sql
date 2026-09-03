-- LOOTFORM: revoke public/authenticated EXECUTE on admin-only test RPCs
-- Date: 2026-09-03
--
-- Security Advisor flagged reset_lootform_beta() and complete_test_topup()
-- as SECURITY DEFINER functions executable by anon AND authenticated via
-- PostgREST RPC. Both are meant to be called ONLY from the server-side
-- Next.js API routes below, which use the service_role key and do their
-- own auth checks BEFORE calling the RPC:
--   - app/api/admin/beta/reset/route.ts   (checks caller email against
--     ADMIN_EMAILS before calling reset_lootform_beta)
--   - app/api/wallet/topup/test/route.ts  (checks caller is logged in,
--     hardcodes the package amount, before calling complete_test_topup)
--
-- Neither function verifies its own caller server-side (reset_lootform_beta
-- never checks p_admin_user_id is really an admin; complete_test_topup
-- never checks p_user_id = auth.uid(), and its token amount is
-- caller-supplied with no cap) -- they rely entirely on the Next.js layer
-- for authorization. Because PostgREST exposes every function in the
-- `public` schema as an RPC endpoint by default, both were directly
-- callable by anon/authenticated, bypassing the Next.js checks entirely:
--   - reset_lootform_beta: the confirmation string is a fixed public
--     literal, not a secret -- anyone could wipe all TEST-mode data.
--   - complete_test_topup: anyone could credit arbitrary LT to any
--     user_id with no amount cap.
--
-- Fix: restrict EXECUTE to service_role only. The Next.js routes above
-- use supabaseAdmin (service_role key), which is unaffected by this
-- revoke, so their behavior is unchanged. No other caller exists (grepped
-- the app for both RPC names -- only these two server routes reference
-- them).
--
-- NOT YET APPLIED to the live project -- saved locally for review/testing.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.reset_lootform_beta(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_lootform_beta(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_lootform_beta(uuid, text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_test_topup(uuid, text, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_test_topup(uuid, text, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_test_topup(uuid, text, text, integer, integer) FROM authenticated;

COMMIT;
