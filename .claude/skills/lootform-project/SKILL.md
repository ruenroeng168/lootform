---
name: lootform-project
description: LOOTFORM project engineering rules. Use when auditing, modifying, debugging, testing, deploying, or reviewing the LOOTFORM Next.js/Supabase project.
---

# LOOTFORM Project Engineer

## Critical checkpoint

Member Home must preserve:

- Character 3D
- HEAD / TOP / BOTTOM
- Loadout
- LV / EXP
- Collection Score
- Global Rank

Guest `/` must use PublicHome and must not require login.

Never remove working Member Home functionality unless explicitly requested.

## Before editing

Always:

1. Read the actual current files first.
2. Run `git status`.
3. Identify what already works.
4. Identify duplicated or legacy systems.
5. Explain the proposed change before modifying code.
6. Change the minimum number of files necessary.

Never rebuild a working system just because another architecture looks cleaner.

## Working method

Work one STEP at a time.

Do not mix unrelated fixes in one STEP.

After every STEP report:

- files changed
- what changed
- tests/checks performed
- remaining risks

## Craft

LOOTFORM Craft is probability based.

Do not convert it to a fixed grade pool unless explicitly requested.

Craft must:

- validate product server-side
- validate design server-side
- validate size server-side
- read craft cost from database
- roll grade server-side
- use atomic wallet deduction + item creation + ledger
- use idempotency
- protect against concurrent requests

Never trust price, grade, wallet balance, owner, reward, or serial number from the browser.

## Serial numbers

Serial allocation must be concurrency safe.

Never use:

SELECT latest item
then latest + 1

Prefer database-side sequence or transactional allocator.

## Supabase

Treat Supabase as a security boundary.

Audit:

- Auth
- RLS
- grants
- RPC permissions
- migrations
- triggers
- ownership
- service role usage

The client must not directly modify authoritative fields such as:

- wallet balance
- EXP
- level
- rank
- item ownership
- grade
- craft result
- game rewards

Do not guess database schema or RLS policies.

If evidence is missing, mark it UNKNOWN.

## Equipment

Prefer `player_equipment` as the current source of truth.

Legacy `equipped_item_id` can remain temporarily for compatibility.

Do not remove legacy compatibility until every consumer is verified migrated.

## 3D

Do not remove Character 3D from Member Home.

When modifying 3D:

- preserve existing loadout
- handle GLB errors
- check mobile performance
- avoid unnecessary Canvas instances
- avoid unnecessary GPU load

## Game

Client game events are telemetry unless validated server-side.

Do not allow the browser to authoritatively grant:

- EXP
- LT
- Items
- Collection Score
- Rank

## Git

Never push directly to `main`.

Use branches such as:

- feature/*
- fix/*
- security/*

Before commit:

1. run git status
2. review git diff
3. check for secrets
4. make sure `.env`, `.next`, and `node_modules` are excluded

Prefer small reversible commits.

## Deployment gate

Before production deployment verify:

1. dependencies install
2. lint
3. TypeScript
4. production build
5. environment variables
6. Supabase migrations
7. RLS
8. test routes disabled
9. Guest `/`
10. Member Home
11. Craft
12. Wallet
13. Collection
14. Equipment
15. Game
16. login/logout

Never report PASS without actually running the check.

If something cannot be tested, report it as UNVERIFIED.
