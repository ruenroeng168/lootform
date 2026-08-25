# LOOTFORM Code Audit Fix Notes

Date: 2026-08-25

## Checkpoint preserved

> Member Home เดิมมี Character 3D + HEAD/TOP/BOTTOM + Loadout + LV/EXP + Collection Score + Global Rank และต้องรักษาไว้ ส่วน Guest `/` ใช้ PublicHome โดยไม่บังคับ Login

## Changes included in this ZIP

1. **Guest `/` restored to PublicHome**
   - Added `components/PublicHome.tsx`.
   - `app/page.tsx` no longer redirects unauthenticated visitors directly to `/login`.
   - Authenticated users still render the existing Member Home without moving or rebuilding its 3D/loadout/stat system.

2. **Guest Navbar state cleaned up**
   - Added authenticated/guest state handling.
   - Guest clicks on protected navigation are sent to `/login`.
   - Guest wallet label shows `LOGIN` rather than a fake `0 LT` player state.

3. **Legacy Equipment API synchronized with the new loadout table**
   - `/api/profile/equip` keeps its existing request contract for Collection/Profile compatibility.
   - Equip/unequip now synchronizes `player_equipment` so Collection actions no longer live only in `player_profiles.equipped_item_id`.
   - Existing unresolved legacy equipment defaults to `TOP` for backwards compatibility.

4. **Craft RNG hardened**
   - Replaced `Math.random()` with `node:crypto.randomInt()`.
   - Grade probability model remains unchanged (probability per craft; no pool depletion logic added).

5. **Game session lifecycle tightened**
   - `COMPLETE` changes session status to `COMPLETED`.
   - `FAIL` changes session status to `FAILED`.
   - `completed_at` and `final_score` are stored on terminal events.
   - Starting a new run marks an older ACTIVE session for the same player/game as `ABANDONED`.
   - Game reward authority remains `TELEMETRY_ONLY`.

6. **Production test routes blocked**
   - Added Next.js 16 `proxy.ts`.
   - The known test pages and `/api/wallet/topup/test` return 404 when `NODE_ENV=production`.

7. **System mode source-of-truth aligned**
   - Beta preview, Beta reset and Test Top-up now read the latest `system_settings` row, matching Craft behavior rather than hard-coding `id = 1`.

8. **Character 3D failure handling improved**
   - Removed dependency on the missing `/models/lootform-character.glb` fallback.
   - Added an error boundary/fallback state for missing or failed GLB loads.
   - Existing Character scene, controls, lighting and WebGL context handling were preserved.

9. **Missing product fallback assets covered**
   - Added `public/products/common.png`, `rare.png`, `epic.png`, `legendary.png` using the existing LOOTFORM logo as a safe fallback so old UI paths do not 404.

10. **Atomic Craft transaction prepared**
    - Added `supabase/migrations/202608250001_atomic_craft.sql`.
    - `/api/craft` now calls `lootform_craft_atomic` instead of doing Item insert, Wallet update and Wallet Ledger as separate application requests.
    - PostgreSQL locks the player's Wallet row, deducts balance, allocates a sequence-backed serial, inserts the Item and inserts the Wallet Ledger in one transaction.
    - Added `craft_requests` idempotency storage keyed by UUID `request_id`.
    - Craft client generates a request UUID and retries one network/5xx failure with the same UUID, so a lost HTTP response does not intentionally charge twice.
    - The unsafe application-level delete rollback and `MAX(items.id) + 1` serial allocator were removed from the Craft route.
    - **Deployment order is mandatory:** run the Supabase migration first, then deploy the matching application code. If the RPC is unavailable, `/api/craft` fails closed with `ATOMIC_CRAFT_NOT_READY` rather than falling back to the unsafe legacy flow.

## Validation performed

- TypeScript/TSX parser syntax check: **PASS** for every modified `.ts/.tsx` file, including the Atomic Craft route/client changes.
- Full `npm ci` / `npm run build`: **not completed in this environment** because dependency installation exceeded the execution window. This is not being reported as a source-code build failure.

## Still requires Supabase / database work before LIVE

These were intentionally **not guessed or rewritten without the real database schema**:

- Apply and validate `supabase/migrations/202608250001_atomic_craft.sql` against the real Supabase schema before deploying the matching Craft API. The code is prepared, but this ZIP cannot prove that the migration has been applied successfully to the live database.
- RLS / grants audit for `wallets`, `items`, `player_profiles`, `player_equipment`, `shipping_addresses`, `wallet_transactions`, `game_sessions` and related tables.
- Fresh-account trigger/function verification for Profile + Wallet + default Character creation.
- Database unique constraints required by equipment and serial allocation logic.
- Real payment/top-up integration; the ZIP still only contains the existing test top-up flow.

Do not treat this ZIP as proof that LIVE Token transactions are production-safe until the Supabase-side items above are verified.
