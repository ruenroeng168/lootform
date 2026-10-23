# ลูกชิ้นนายช่าง (LUKCHIN NAICHANG) — Milestone 01

Food-ordering web app for ลูกชิ้นนายช่าง, Ubon Ratchathani. Next.js 16 (App
Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth) · Vercel.

**Status: pre-launch preview.** Ordering and payment are hard-disabled
(`ORDERING_ENABLED = false` in `lib/store-config.ts`). The app has no form,
server action or API route that creates an order or collects money.

## Routes

| Route | Audience | Status |
| --- | --- | --- |
| `/` | Customer | Home page: hours 09:00–22:00, 5 km delivery radius, pickup and delivery, PromptPay |
| `/menu` | Customer | Category placeholders only. No prices yet. |
| `/cart` | Customer | Placeholder |
| `/checkout` | Customer | Disabled walkthrough. Cannot submit. |
| `/staff/login` | Staff / rider / admin | Supabase email + password. Disabled until env vars are set. |
| `/staff/orders` | staff, admin | Placeholder, checked by role on the server |
| `/rider` | rider, admin | Placeholder, checked by role on the server |
| `/admin` | admin | Placeholder, checked by role on the server |

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | for auth | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | for auth | Or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

If they are missing, the site still builds and runs. Customer pages work, and
the staff, rider and admin pages fail closed with a "not connected" notice.
No service-role key is used in this milestone.

## Security model

- Authorization runs on the server for each request. `requireRole()` in
  `lib/auth.ts` checks the session with `supabase.auth.getUser()`, then reads
  the caller's `staff_profiles` row. RLS lets a user read only their own row.
  `proxy.ts` only refreshes the session cookie.
- Row Level Security is on for every table (`supabase/migrations`):
  - Visitors (anon) can read the active catalog and store info. They have no
    privileges on orders, order items, payments, deliveries, staff profiles
    or status history.
  - Staff see their own store only. Riders see an order only while it is
    assigned to them (status assigned or picked up) and only within their
    store. Customers see their own orders.
  - Only admins can manage roles. Column-level grants stop staff from
    changing totals or amounts.
  - A verified payment can't be reversed, and its verifier and time can't be
    rewritten. Order status history is written only by a trigger.
- Money is stored as integer satang. Payment slips are stored as paths into
  a private bucket, never as public URLs.

## Commands

```bash
npm install
npm run dev          # local dev
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # unit tests (business hours)
# RLS behaviour tests against a THROWAWAY local Postgres (never a real project):
PGHOST=/socket/dir PGPORT=5432 PGUSER=postgres supabase/tests/rls_smoke.sh
```

## Database

Migrations are in `supabase/migrations` and the seed is in `supabase/seed.sql`
(one store row, no coordinates, ordering disabled). They have not been applied
to any hosted Supabase project yet. To apply them:

```bash
supabase link --project-ref <ref>
supabase db push        # review the plan first; take a backup on any DB holding data
psql "$DB_URL" -f supabase/seed.sql
```

To create the first admin: create the user in Supabase Auth, then run as the
service role:
`insert into staff_profiles (user_id, role) values ('<auth user id>', 'admin');`

## Data still needed from the owner

Store coordinates, address and phone, the real menu and prices, the PromptPay
receiver ID, and the delivery fee schedule.
