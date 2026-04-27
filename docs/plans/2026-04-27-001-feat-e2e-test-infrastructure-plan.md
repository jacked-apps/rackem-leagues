---
title: E2E Test Infrastructure (Playwright sandbox + factories + 4 starter scenarios)
type: feat
status: active
date: 2026-04-27
origin: docs/brainstorms/e2e-test-infrastructure-requirements.md
---

# E2E Test Infrastructure

## Overview

Build the v1 Playwright test infrastructure for rackem-leagues: a foundation
seed (1 test org, 5 users), test data factories, multi-user auth setup that
replaces the existing PR #78 single-user model, demo run mode, and 4 starter
scenarios that prove the pattern works (lineup-flow, double-duty-handoff,
scoring + spectator, wizard-tour-as-demo).

After this lands, adding a new E2E test for a future feature is a few dozen
lines on top of factories. v1 is local-Supabase-only.

## Problem Frame

PR #78 landed Playwright with a single user, UI-driven login, and one example
test. The recent lineup race-condition work (in-flight on `feature/lineup-
polish`; see `docs/brainstorms/lineup-race-condition-fix-requirements.md` on
that branch) shipped from manual two-browser testing — exposing how brittle
the current setup is for anything beyond a single-user smoke. There is no
shared test sandbox, no factories, no multi-actor pattern, and no isolation
between tests, so every new spec would re-invent setup from scratch.

(See origin: `docs/brainstorms/e2e-test-infrastructure-requirements.md`.)

## Requirements Trace

- **R1.** Foundation seed (`database/e2e_seed.sql`) — Units 1, 2.
- **R2.** Real safety guard is `E2E_LOCAL_OK=true` env var (database-name
  check is consistency only) — Units 1, 2.
- **R3.** `pnpm e2e:setup` end-to-end — Unit 2.
- **R4.** No collision with `seed_test_users.sql`; `e2e-` prefix — Unit 1.
- **R5–R6.** Foundation users seeded with auth row + members row, pre-
  confirmed, distinct password from RLS seed, password sourced from
  `.env.local` (not committed plaintext) — Units 1, 3.
- **R7–R10.** Factories under `tests/e2e/fixtures/`, sensible defaults,
  resolved-preferences API, unique throwaway names — Unit 5.
- **R11–R12.** Multi-user auth replaces single-user PR #78 model; per-user
  storage states; specs declare starting user; `dashboard.spec.ts` migrated
  in the same unit — Units 3, 4.
- **R13–R15.** Run modes (preserve regression; `E2E_DEMO=1` adds slowMo +
  headed; video already on; demo videos may capture session details) —
  Unit 4.
- **R16.** `lineup-flow.spec.ts` — Unit 6.
- **R17.** `double-duty-handoff.spec.ts` — Unit 7 (depends on the lineup
  race-condition merge; see Risks).
- **R18.** `scoring.spec.ts` (with spectator observer) — Unit 8.
- **R20.** `wizard-tour.spec.ts` (doubles as demo) — Unit 9.
- **R21.** No per-test cleanup (foundation rebuild via `pnpm e2e:setup`
  on demand) — Units 5, 6–9 (factory pattern).
- **R23–R24.** README rewritten + TABLE_OF_CONTENTS.md updated — Unit 10.

R19 (same-team scoring race) is deferred from v1 per the origin doc.

## Scope Boundaries

- **In scope:** local Supabase only, single test org, 5 users, factories
  layer, replacement of PR #78 single-user auth (including migration of
  `dashboard.spec.ts`), demo run mode, the 4 starter scenarios, README +
  TOC updates.
- **Out of scope:** staging tests, production tests, CI integration, Org B /
  cross-org tests, R19 same-team race, R22 `cleanupOnTeardown` factory
  option, hosted demo environment, polished sales reel pipeline.

### Deferred to Separate Tasks

- **Lineup race-condition fix on `feature/lineup-polish`** — Unit 7 (R17)
  cannot pass until that work merges. **Recommended sequencing: ship Unit 7
  inside `feature/lineup-polish`'s PR** so the fix and its regression test
  ship together (single review surface; smaller blast radius). If that's
  not feasible, ship Units 1–6 + 8–10 here, hold Unit 7 as a follow-up PR
  on this branch and merge it after the fix lands. If the fix is
  superseded by a different approach, Unit 7's *scenario* (double-duty
  placeholder resolution) remains valid but the specific assertion must be
  re-checked against whatever shipped.
- **R19 same-team scoring race revival** — separate ticket (defines app-
  side conflict resolution behavior first), then trivially adds the spec.
- **CI integration + staging mode** — separate v2 plan. Note for that v2:
  several v1 choices (hardcoded local-only service JWT, foundation user
  reuse with optional `fullyParallel: false`, no `cleanupOnTeardown`) will
  become explicit migration items, not configuration switches.

## Context & Research

### Relevant Code and Patterns

- `supabase/seed_test_users.sql` — canonical static-hash `auth.users`
  seeding. Reuse the shape (`ON CONFLICT (id) DO NOTHING`, deterministic
  UUIDs, matching `members` insert with `system_player_number`).
- `database/dev_bootstrap_full.sql` (lines 107–121, 127ff) — canonical full-
  fixture INSERT shapes including the **NOT NULL fields on `organizations`
  and `venues`** that Unit 1 must populate (organization_address,
  organization_city, organization_state, organization_zip_code,
  organization_email, organization_phone, stripe_customer_id,
  payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
  billing_zip; venue address/city/state/zip/phone). Mirror the dev-test
  values (`'cus_dev_<id>'`, `'pm_dev_<id>'`, `'4242'`, `'visa'`, etc.).
- `src/test/dbTestUtils.ts` — exposes `createServiceClient()` (hardcoded
  demo service-role JWT for local Supabase) and `getPostgresPool()`. The
  factory layer **copies** the construction into
  `tests/e2e/fixtures/serviceClient.ts` rather than importing across the
  src/tests boundary (`tsconfig.app.json` excludes `src/test`, and the
  demo JWT is publicly known — duplication has zero security cost).
- `src/wizards/league-v2/useCreateLeagueV2.ts` (line ~49) — dual-write
  pattern (legacy `leagues.team_format` + modular `preferences` upsert
  via `onConflict: 'entity_type,entity_id'`).
- `src/wizards/league-v2/presetMappings.ts` — **critical for the factory:**
  `team_format` is a property of the *preset*, not derivable from
  `lineup_size`. fargo_5v5 has lineup_size 5 + `team_format='5_man'`;
  standard_5v5 has lineup_size 5 + `team_format='8_man'`. Factories must
  accept `team_format` as input (default to `'8_man'` for the standard
  5v5 preset our starter scenarios use), not derive it.
- `src/api/hooks/useResolvedLeaguePrefs.ts` — preferences read seam
  through the `resolved_league_preferences` view. Lazy-derives modular
  fields from `team_format` if the preferences row is empty.
- `src/hooks/lineup/useMatchPreparation.ts` — client-side match prep
  (only home team prepares). Inserts directly into `match_games`
  (line ~386) using `generateGameOrder(lineupSize, useDoubleRoundRobin)`.
  R17 exercises this; **R18 drives the lineup-lock flow through the UI
  rather than bypassing prep,** because `getLiveMatchesForLeague` filters
  on `started_at IS NOT NULL` (set by `useLineupPersistence.ts` when both
  lineups lock). A `createMatchScoringReady` factory that bypasses this
  produces a match the spectate route ignores.
- `src/hooks/lineup/useLineupPersistence.ts` (line ~157) — sets
  `matches.started_at` when the second lineup locks; load-bearing for
  the spectate route filter.
- `src/api/queries/matches.ts` (line ~170) — `getLiveMatchesForLeague`
  filters `.not('started_at', 'is', null).neq('status', 'completed')`.
- `src/realtime/useMatchRealtime.ts` — channel `match_${matchId}` watching
  `matches`/`match_lineups`/`match_games`. Drives R18's spectator
  assertion.
- `src/player/MatchLineup.tsx` (lines ~55–56) — defines the substitute
  sentinel UUIDs as `SUB_HOME_ID = '00000000-0000-0000-0000-000000000001'`
  and `SUB_AWAY_ID = '00000000-0000-0000-0000-000000000002'`. Substitute
  type is tracked via a separate `substituteType` state flag, not via
  distinct UUIDs. R17 must assert that `match_games` rows do NOT contain
  these sentinel UUIDs in `home_player_id` / `away_player_id`.
- `src/components/lineup/OpponentSubstituteModal.tsx` — selectors for
  R17's handoff resolution.
- `playwright.config.ts` — current setup project; storage state wiring
  point; webServer auto-start of Vite preserved. Modified by Unit 4.
- `tests/e2e/auth.setup.ts` — single-user UI-driven login (PR #78).
  Replaced by Unit 3 with a parameterized **UI-login-per-user** loop
  (programmatic Supabase auth via `page.evaluate` doesn't work — the
  Supabase client is a module export, not on `window`).
- `tests/e2e/dashboard.spec.ts` — current sole test. Migrated by Unit 3
  (folded in, not a separate unit) to use `getStorageState('captain-1')`.
- `scripts/create-test-users.ts` — uses `supabase.auth.admin.createUser`
  to seed users. Considered as an alternative to the bcrypt-hash
  approach; not adopted because (a) Unit 1 keeps everything in one SQL
  file with idempotency via `ON CONFLICT`, (b) the existing
  `seed_test_users.sql` pattern is already proven. Mentioned here so the
  implementer doesn't re-invent the same investigation.

### Schema & Migrations (verified during research)

- `leagues.team_format` is **NOT NULL** with CHECK on `('5_man','8_man')`.
  Factory writes one of those two, paired with the modular `preferences`
  row.
- `matches` insert auto-creates the two `match_lineups` rows via
  `trigger_auto_create_match_lineups`. Factories must not insert
  `match_lineups` manually.
- `leagues` insert auto-creates a preferences row (all modular fields
  NULL) via `trigger_create_league_preferences AFTER INSERT`. The
  factory's modular write must therefore **upsert**, not insert (the
  plan already says upsert; this note is for the implementer who might
  read just `INSERT INTO preferences`).
- `lock_tier1_league_preferences BEFORE UPDATE` raises if `handicap_type`
  or `lineup_size` is changed once non-NULL. Factories cannot mutate a
  league's tier-1 prefs after creation; tests that need different prefs
  create a new throwaway league.
- `matches` does NOT auto-set `started_at`. The lineup-lock UI does
  (`useLineupPersistence.ts`). Factories that fast-forward past lineup
  must set `started_at` explicitly.
- `match_games` constraints: positions 1–5 only,
  `UNIQUE(match_id, game_number)`, `NOT (break_and_run AND golden_break)`.
- `venues.total_tables` is generated; requires `bar_box_table_numbers`
  (or regulation equivalent) populated. See `dev_bootstrap_full.sql:127`.
- `members.system_player_number` ranges already used: 100001–100004,
  BCA-10001–10020. E2E uses **200001+**.
- `organization_staff` row is created by trigger when an organization
  inserts. Verify during Unit 1: when service-role inserts the org with
  `created_by = LO's member id`, does the trigger correctly populate the
  staff row? If not, Unit 1 inserts the staff row manually; R20 (wizard
  tour) depends on the LO actually having operator authority.

### Institutional Learnings

`docs/solutions/` does not exist on this repo. Treat as greenfield. Two
post-merge `/ce-compound` candidates: the bcrypt-hash format that
authenticates against GoTrue (Unit 1's verification gate output), and any
multi-context Playwright + Supabase Realtime pitfalls (Units 7–8).

### External References

None gathered. Patterns are well-established locally; the codebase has
the seam infrastructure (service-role client shape, dev_bootstrap fixture,
dual-write preferences).

## Key Technical Decisions

- **Auth setup uses UI login per foundation user, not programmatic.**
  `page.evaluate(() => supabase.auth.signInWithPassword(...))` doesn't
  work because the Supabase client is a module-scoped import, not on
  `window`. UI-login × 5 users at suite startup is a one-time cost
  (~10–15s) that also smokes the login flow as a side effect. *Reversal:*
  if startup time becomes problematic later, switch to Node-side
  `signInWithPassword` using `@supabase/supabase-js` directly in the
  Playwright runner process and synthesize storageState by injecting the
  resulting session into localStorage — but defer that complexity.
- **Foundation password lives in `.env.local` (`E2E_PW`), not in the
  seed-file comment.** The seed file commits only the bcrypt hash with a
  comment naming the env var the hash was generated from. `users.ts`
  reads `process.env.E2E_PW` (with a clear startup error if unset).
  *Rationale:* keeps plaintext credentials out of tracked files; matches
  the existing `.env.example` pattern for `E2E_TEST_EMAIL`/`PASSWORD`.
- **Bcrypt seeding mechanism: pre-computed static hash committed to
  `database/e2e_seed.sql`** (mirrors `seed_test_users.sql`). The
  implementer generates the hash once with `pnpm dlx bcrypt-cli "$E2E_PW"
  10` (or equivalent producing a `$2a$10$...` hash) and embeds it. The
  bcrypt verification gate in Success Criteria ensures it actually
  authenticates before R5 is closed.
- **Service-role client is local to `tests/e2e/fixtures/serviceClient.ts`,
  not imported from `src/test/dbTestUtils.ts`.** `tsconfig.app.json`
  excludes `src/test/`, so cross-boundary import is fragile. The demo
  service-role JWT is publicly known (it's Supabase's default local
  demo key), so duplication carries no security cost. Add a prominent
  comment at the top of the file: "Hardcoded demo JWT for local
  Supabase only. NEVER replace with a real service-role key — use
  `process.env.SUPABASE_SERVICE_ROLE_KEY` if v2 staging support is added."
- **`team_format` is an explicit factory parameter, not derived from
  `lineup_size`.** Default: `'8_man'` (matches the standard 5v5 preset
  our starter scenarios use). Test cases that need fargo 5v5 pass
  `'5_man'`. Verified via `presetMappings.ts`.
- **Project-level `storageState` removed from `playwright.config.ts`.**
  Specs declare starting user via `test.use({ storageState:
  getStorageState('<key>') })` from `tests/e2e/fixtures/users.ts`.
- **`E2E_DEMO=1` env flag drives demo mode** in `playwright.config.ts` —
  overrides `use.headless = false` and `use.launchOptions.slowMo = 500`.
- **Startup guard in `playwright.config.ts`: throw at config-load if
  `E2E_BASE_URL` is non-localhost,** unless an explicit
  `E2E_REMOTE_OK=true` flag is set. This catches the "I forgot to set
  E2E_LOCAL_OK and now I'm running tests against staging" case (the
  primary danger path).
- **R18 (scoring) drives the lineup-lock flow through the UI** rather
  than bypassing it via a `createMatchScoringReady` factory. *Rationale:*
  the spectate route filters on `matches.started_at`, which the lineup-
  lock UI sets. Bypassing the UI would require the factory to mirror
  that write — duplicating logic that `useLineupPersistence.ts` owns and
  introducing test-vs-reality drift exactly where E2E should match
  production. The factory layer ends at "match ready for lineup"; UI
  drives lineup → prep → scoring.
- **Foundation seed cleanup uses `DELETE`** (targeted by `e2e-` prefix
  on leagues; explicit org/venue/user/member IDs for foundation
  artifacts). Faster than `supabase db reset`. Org name is `'E2E Test
  Org'` (case-sensitive); the cleanup explicitly deletes by that string,
  not by `LIKE 'e2e-%'` (which wouldn't match).
- **Unit 2's SQL guard mechanism: `SET e2e.local_ok = 'true'`** (session-
  level, NOT `SET LOCAL`) piped via `psql -c` before `-f`. *Rationale:*
  psql's `-v` flag sets a psql substitution variable, not a Postgres GUC.
  `SET LOCAL` is transaction-scoped, and psql in default autocommit mode
  treats each `-c` and `-f` as separate implicit transactions — `SET
  LOCAL` would revert before `-f` runs. Plain `SET` sets a session-
  level GUC that survives across the same psql invocation's statements,
  which is what we need.

## Open Questions

### Resolved During Planning

- **What runs the seed?** A new `scripts/e2e-setup.mjs` invoked by
  `pnpm e2e:setup`. Pattern: `psql -h localhost -p 54322 -U postgres -d
  postgres -c "SET LOCAL e2e.local_ok = 'true'" -f database/e2e_seed.sql`
  (single connection so `SET LOCAL` survives into the seed).
- **How do specs pick a starting user?**
  `test.use({ storageState: getStorageState('captain-1') })` from the
  palette helper.
- **Does the factory writes path bypass RLS?** Yes — service-role client
  for setup operations.
- **Does the auth setup smoke the login UI?** Yes (UI-login-per-user is
  the chosen mechanism). No need for a separate login-smoke spec.

### Deferred to Implementation

- **Exact bcrypt hash value** — generated during Unit 1 implementation,
  verified by the auth setup actually authenticating at runtime.
- **`bar_box_table_numbers` array shape** — look at
  `dev_bootstrap_full.sql:127` at write time.
- **Whether the `organization_staff` trigger runs correctly when service-
  role inserts the org.** Verify during Unit 1; if not, insert the staff
  row manually.
- **Whether `fullyParallel: true` causes user-role collisions** when one
  foundation user captains multiple simultaneous throwaway leagues. Test
  by running R16 + R17 (or R16 twice) concurrently. If collisions occur,
  set `fullyParallel: false` for v1.
- **What latency is acceptable for the R18 spectator assertion.** Use a
  generous Playwright-default `toBeVisible` wait (~5s) for v1; revisit
  if flaky.

## Output Structure

```
database/
  e2e_seed.sql                       # NEW (Unit 1) — seed script

scripts/
  e2e-setup.mjs                      # NEW (Unit 2) — pnpm e2e:setup runner

tests/e2e/
  auth.setup.ts                      # REWRITE (Unit 3) — multi-user UI login
  fixtures/                          # NEW directory
    users.ts                         # NEW (Unit 3) — palette + helpers
    serviceClient.ts                 # NEW (Unit 5) — local service-role client
    factories.ts                     # NEW (Unit 5) — createLeague, etc.
                                     # May split into factories/<area>.ts
                                     # if individual file grows past ~100
                                     # lines (per project file-size target).
  specs/                             # NEW directory
    lineup-flow.spec.ts              # NEW (Unit 6, R16)
    double-duty-handoff.spec.ts     # NEW (Unit 7, R17 — held on lineup
                                     # race fix)
    scoring.spec.ts                  # NEW (Unit 8, R18)
    wizard-tour.spec.ts              # NEW (Unit 9, R20)
  dashboard.spec.ts                  # MODIFY (Unit 3) — migrate to palette
  README.md                          # REWRITE (Unit 10)

playwright.config.ts                 # MODIFY (Unit 4) — demo + guard
package.json                         # MODIFY (Unit 2) — pnpm e2e:setup,
                                     #                  pnpm test:e2e:demo
.env.example                         # MODIFY (Unit 1/2) — document E2E_PW,
                                     #                    E2E_LOCAL_OK
TABLE_OF_CONTENTS.md                 # MODIFY (Unit 10) — folded with README
```

## High-Level Technical Design

> *Directional guidance for review, not implementation specification.*

**Auth setup pattern** (Unit 3) — UI login, parameterized over palette:

```
// tests/e2e/fixtures/users.ts
const E2E_PW = process.env.E2E_PW;
if (!E2E_PW) throw new Error('E2E_PW must be set in .env.local');

export const E2E_USERS = {
  'lo':        { email: 'e2e-lo@test.test',        password: E2E_PW },
  'captain-1': { email: 'e2e-captain-1@test.test', password: E2E_PW },
  'captain-2': { email: 'e2e-captain-2@test.test', password: E2E_PW },
  'captain-3': { email: 'e2e-captain-3@test.test', password: E2E_PW },
  'observer':  { email: 'e2e-observer@test.test',  password: E2E_PW },
} as const;

export const getStorageState = (key) =>
  `tests/e2e/.auth/${key}.json`;

// tests/e2e/auth.setup.ts (single setup test, sequential loop)
setup('authenticate all foundation users', async ({ browser }) => {
  for (const [key, { email, password }] of Object.entries(E2E_USERS)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('/dashboard', { timeout: 15_000 });
    await context.storageState({ path: getStorageState(key) });
    await context.close();
  }
});
```

**Multi-context spec** (Unit 7 — R17 double-duty):

```
test.use({ storageState: getStorageState('captain-1') });

test('opponent resolves double-duty placeholder', async ({ browser, page }) => {
  const { match } = await createMatchReadyForLineup({
    homeCaptain: 'captain-1', awayCaptain: 'captain-2',
  });
  // home (default page context): enter lineup with double-duty placeholder, lock
  // away: open second context with storageState('captain-2'), drive
  //       OpponentSubstituteModal, pick a real player
  // assert match_games rows: home_player_id != SUB_HOME_ID
  //                         and away_player_id != SUB_AWAY_ID
});
```

**`pnpm e2e:setup` flow** (Unit 2):

```
1. node scripts/e2e-setup.mjs:
2.   assert process.env.E2E_LOCAL_OK === 'true' or fail
3.   spawn psql with: -h localhost -p 54322 -U postgres -d postgres
4.                    -c "SET e2e.local_ok = 'true'"   (session-level)
5.                    -f database/e2e_seed.sql
6.   (single psql connection so the session GUC persists into -f)
7. The SQL DO $$ BEGIN ... END $$ block re-asserts:
8.   current_database() = 'postgres'
9.   AND coalesce(current_setting('e2e.local_ok', true), '') = 'true'
10.  Raise exception otherwise.
11. Targeted DELETEs from leaf inward (team_players → teams →
12.   match_games → match_lineups → matches → season_weeks → seasons →
13.   leagues, then organization_staff → venues → organizations,
14.   then members → auth.users), each filtered by e2e- prefix or
15.   foundation IDs.
16. INSERTs in dependency order.
```

## Implementation Units

- [ ] **Unit 1: Foundation seed (`database/e2e_seed.sql`)**

**Goal:** Idempotent SQL script that creates 1 test org, 5 users, 1 venue,
member rows, with all NOT NULL fields populated. Self-guarded.

**Requirements:** R1, R2 (in-SQL portion), R4, R5, R6.

**Dependencies:** None.

**Files:**
- Create: `database/e2e_seed.sql`
- Modify: `.env.example` (add commented `E2E_PW=` and `E2E_LOCAL_OK=true`
  entries with explanatory comments).

**Approach:**
- Top of file: comment block naming `E2E_PW` as the source of the hash;
  hash regeneration command (`pnpm dlx bcrypt-cli "$E2E_PW" 10`); local-
  only acceptance. **No plaintext password in the file.**
- `DO $$ BEGIN ... END $$` guard: assert
  `current_database() = 'postgres'` AND
  `coalesce(current_setting('e2e.local_ok', true), '') = 'true'`. Raise
  exception otherwise. (The `coalesce` handles the NULL-from-unset-GUC
  case explicitly — `NULL = 'true'` evaluates to NULL not FALSE, which
  would silently fall through some guard patterns.)
- DELETE block (idempotency — explicit leaf-inward order, do not rely on
  cascades alone since not every FK in the schema is `ON DELETE CASCADE`;
  during implementation, run `\d+ <table>` for each and add or remove
  redundant DELETEs as the actual cascade rules dictate):
  1. `DELETE FROM team_players WHERE team_id IN (SELECT id FROM teams
     WHERE league_id IN (SELECT id FROM leagues WHERE name LIKE 'e2e-%'))`.
  2. `DELETE FROM match_games`, `match_lineups`, `matches`,
     `season_weeks`, `seasons`, `teams`, `leagues` — all filtered to
     the `e2e-%` league chain.
  3. `DELETE FROM organization_staff WHERE organization_id IN
     (SELECT id FROM organizations WHERE organization_name = 'E2E Test Org')`.
  4. `DELETE FROM venues` and `organizations` — filtered to E2E Test Org.
  5. `DELETE FROM members WHERE system_player_number BETWEEN 200001
     AND 200099`.
  6. `DELETE FROM auth.users WHERE email LIKE 'e2e-%@test.test'`.
- INSERT block:
  1. **5 `auth.users` rows** — deterministic UUIDs
     (`e0e0e0e0-0001-...` etc.), fixed bcrypt hash (literal value
     committed; generated from `E2E_PW`), `email_confirmed_at = NOW()`,
     `aud = 'authenticated'`, `role = 'authenticated'`,
     `instance_id = '00000000-0000-0000-0000-000000000000'`,
     `raw_app_meta_data = '{"provider":"email","providers":["email"]}'`,
     `raw_user_meta_data = '{}'`. ON CONFLICT (id) DO NOTHING.
  2. **5 `members` rows** — full column set including `first_name`,
     `last_name`, `email`, `phone`, `city`, `state`, `role`,
     `system_player_number` (200001–200005). LO gets
     `role = 'league_operator'`; others get `'player'`. Pattern from
     `seed_test_users.sql:122–186`.
  3. **1 `organizations` row** — populates ALL NOT NULL fields per the
     baseline migration: `organization_name = 'E2E Test Org'`,
     `organization_address`, `organization_city`, `organization_state`,
     `organization_zip_code`, `organization_email`, `organization_phone`,
     `stripe_customer_id = 'cus_dev_e2e'`, `payment_method_id =
     'pm_dev_e2e'`, `card_last4 = '4242'`, `card_brand = 'visa'`,
     `expiry_month = 12`, `expiry_year = 2030`, `billing_zip`,
     `created_by = LO's member id`. Mirror the values used in
     `dev_bootstrap_full.sql:107–121`.
  4. **Verify or insert `organization_staff`** for the LO. The
     `create_owner_staff` trigger writes to `organization_staff` with
     column `position` (not `role`) — verified at baseline migration
     line 528+. Verify the trigger fires under service-role insert; if
     it doesn't, `INSERT INTO organization_staff (organization_id,
     member_id, position) VALUES (..., ..., 'owner') ON CONFLICT DO
     NOTHING`. CHECK constraint on `position` accepts
     `'owner' | 'admin' | 'league_rep'`.
  5. **1 `venues` row** — populate ALL NOT NULL fields:
     `venue_name = 'E2E Test Venue'`, `street_address`, `city`, `state`,
     `zip_code`, `phone`, `bar_box_table_numbers = ARRAY[1,2,3,4]`
     (matches the CHECK so `total_tables` generates a positive value),
     `organization_id`. Pattern from `dev_bootstrap_full.sql:127ff`.
- Final `RAISE NOTICE` listing the foundation user emails and the
  org/venue IDs.

**Patterns to follow:**
- `supabase/seed_test_users.sql` for auth.users + members shape
  (re-confirmed during research as the canonical pattern).
- `database/dev_bootstrap_full.sql` for organization, organization_staff,
  and venue shapes (specifically lines 107–121 + 127ff).

**Test scenarios:**
- Happy path: run via Unit 2's runner; assert 5 users in `auth.users`,
  5 in `members`, 1 in `organizations`, 1 staff row, 1 in `venues`.
- Idempotency: run twice in a row; no duplicates, no errors.
- Guard: omit `E2E_LOCAL_OK`; runner exits with clear error.
- Guard at SQL level: try `psql -f database/e2e_seed.sql` directly
  without `SET LOCAL`; SQL DO block raises.
- Bcrypt verification: separately call
  `supabase.auth.signInWithPassword({ email: 'e2e-lo@test.test',
  password: E2E_PW })`; assert success. **This is the Success Criteria
  gate.**
- Cleanup: pre-seed a `leagues` row with `name = 'e2e-leftover-x'`;
  re-run; row is deleted before insert.
- Operator authority: insert a league as `e2e-lo` via the app's normal
  league-creation path (or a service-role insert with `created_by =
  e2e-lo's member id`); LO's dashboard surfaces it.

**Verification:**
- `pnpm e2e:setup` returns exit code 0 on a clean DB.
- Logging in via the Supabase auth client with each of the 5 emails +
  `E2E_PW` returns a session.
- LO has `organization_staff` row with `position = 'owner'`.

---

- [ ] **Unit 2: Setup runner (`pnpm e2e:setup` + `scripts/e2e-setup.mjs`)**

**Goal:** One-command rebuild from clean DB; enforces `E2E_LOCAL_OK=true`
at the Node level before invoking psql; uses `SET LOCAL` for the SQL
guard.

**Requirements:** R2 (env-var portion), R3.

**Dependencies:** Unit 1.

**Files:**
- Create: `scripts/e2e-setup.mjs`
- Modify: `package.json` — add:
  - `"e2e:setup": "node scripts/e2e-setup.mjs"`
  - `"test:e2e:demo": "E2E_DEMO=1 playwright test"`
- Modify: `package.json` — handle the existing `test:e2e:staging`
  script. It currently sets `E2E_BASE_URL=https://staging.rackemleagues.com`
  but Unit 4's startup guard now throws on any non-localhost target
  unless `E2E_REMOTE_OK=true` is set. Either (a) remove the script
  entirely (matches "v1 is local-only" intent), or (b) update it to
  `"test:e2e:staging": "E2E_REMOTE_OK=true E2E_BASE_URL=https://staging.rackemleagues.com playwright test"`
  so it stays functional. Recommended: **remove** for v1, re-add in
  the v2 staging plan with appropriate guards.

**Approach:**
- `scripts/e2e-setup.mjs`:
  1. Read `process.env.E2E_LOCAL_OK`. If not `'true'`, exit 1 with a
     clear message naming the missing/wrong env var.
  2. Spawn psql with: `-h localhost -p 54322 -U postgres -d postgres
     -c "SET e2e.local_ok = 'true';" -f database/e2e_seed.sql`.
     Single connection — plain `SET` (session-level GUC) persists into
     the `-f` file. **Do not use `SET LOCAL`** here: in psql's default
     autocommit mode, `SET LOCAL` reverts at the end of the implicit
     transaction wrapping the `-c` statement, and `-f` would see no
     GUC. Verified semantics.
  3. Pipe psql stdout/stderr; exit with psql's exit code.
- Loud-fail behaviors: if psql is not installed, exit with installation
  hint; if Supabase isn't running on port 54322, exit with `pnpm
  db:start` hint.

**Patterns to follow:**
- `database/tests/README.md` for the psql invocation shape.
- Existing scripts under `scripts/` for Node-script structure
  (`scripts/clean-rulebook.ts`, etc.).

**Test scenarios:**
- Happy path: with `E2E_LOCAL_OK=true`, command succeeds; foundation
  present.
- Guard: without `E2E_LOCAL_OK`, command exits non-zero with a clear
  named-error message.
- Re-run: idempotent (rolls into Unit 1's idempotency).
- Postgres not listening: clear error pointing at `pnpm db:start`.

**Verification:**
- `pnpm e2e:setup` works on a fresh checkout (after `pnpm install`,
  `pnpm db:start`, and writing `E2E_LOCAL_OK=true` + `E2E_PW=...` in
  `.env.local`).
- `E2E_LOCAL_OK= pnpm e2e:setup` fails clearly.

---

- [ ] **Unit 3: Multi-user auth setup + dashboard.spec.ts migration**

**Goal:** Replace the single-user PR #78 setup with a parameterized
multi-user setup that produces 5 storage state files via UI login per
user. Migrate `dashboard.spec.ts` onto a foundation user as part of the
same change so the auth replacement and its first consumer ship together.

**Requirements:** R5 verification gate, R11, R12.

**Dependencies:** Unit 1 (credentials must exist in DB) AND Unit 4
(must land first or concurrently). Unit 4 removes the project-level
`storageState` from `playwright.config.ts`; Unit 3's specs declare
their own. If Unit 3 lands while the project-level default is still
present, specs that try `test.use({ storageState: ... })` may collide
with the default in unexpected ways.

**Files:**
- Create: `tests/e2e/fixtures/users.ts`
- Rewrite: `tests/e2e/auth.setup.ts`
- Modify: `tests/e2e/dashboard.spec.ts`

**Approach:**
- `users.ts` exports the `E2E_USERS` map and `getStorageState(key)`. At
  module load, throw if `process.env.E2E_PW` is undefined or empty.
- `auth.setup.ts` is **a single Playwright setup test** that loops the
  palette serially. Do not split into multiple setup tests (Playwright's
  setup-project dependency is at the project level; multiple tests
  would race the storage-state writes).
- For each user: new browser context → `/login` → fill email + password
  → click Login → `waitForURL('/dashboard', { timeout: 15_000 })` →
  `context.storageState({ path: getStorageState(key) })` → context
  close. The same UI smoke runs for every user, so the login form is
  exercised 5× per setup run (free smoke coverage).
- `dashboard.spec.ts`: add `test.use({ storageState: getStorageState
  ('captain-1') })`, update the welcome-heading regex to match
  `e2e-captain-1`'s first name, remove any references to the legacy
  single-user path or `.env.local`'s `E2E_TEST_EMAIL`/`PASSWORD`.

**Patterns to follow:**
- The existing `tests/e2e/auth.setup.ts` for the storage-state save
  pattern (just parameterized).
- `src/login` (or wherever the login form lives) for selectors;
  `page.getByLabel('Email')` etc. already work in the existing setup.

**Test scenarios:**
- Happy path: setup writes 5 `tests/e2e/.auth/<key>.json` files.
- Each storage state authenticates the right user — Playwright's project
  dependency (`chromium` depends on `setup`) means specs only run after
  setup succeeds; if storage state doesn't authenticate, specs redirect
  to `/login` and fail at the first navigation assertion.
- Failure path: if `pnpm e2e:setup` was never run, login fails with
  "Invalid login credentials"; auth setup fails fast with a clear
  message naming `pnpm e2e:setup`.
- `dashboard.spec.ts` passes against the foundation.

**Verification:**
- After running auth setup, `tests/e2e/.auth/` contains exactly 5 files.
- `pnpm test:e2e -- dashboard` passes (since
  `dashboard.spec.ts` is migrated in this same unit).

---

- [ ] **Unit 4: Playwright config — demo mode + safety guards + project-level storageState removal**

**Goal:** Wire `E2E_DEMO=1` to slowMo + headed; remove project-level
`storageState` so specs declare their own; add startup guard for the
"forgot E2E_LOCAL_OK + pointed at staging" case.

**Requirements:** R13, R14, R15.

**Dependencies:** None (can land before Unit 3 if desired; specs need
both Unit 3 and Unit 4 in place to run).

**Files:**
- Modify: `playwright.config.ts`

**Approach:**
- Top of file (after `dotenv.config(...)`), startup guard:
  `if (E2E_BASE_URL && !E2E_BASE_URL.includes('localhost') &&
  !E2E_BASE_URL.includes('127.0.0.1') && process.env.E2E_REMOTE_OK !==
  'true') { throw new Error('E2E_BASE_URL points at a non-local target.
  This v1 suite is local-only. Set E2E_REMOTE_OK=true to override.'); }`.
  *Note:* the guard fires on ANY non-localhost target unless explicitly
  overridden, including the staging-without-E2E_LOCAL_OK case.
- Read `E2E_DEMO`. If set: override `use.headless = false` and
  `use.launchOptions.slowMo = 500`.
- Remove the `storageState: 'tests/e2e/.auth/user.json'` line from the
  `chromium` project. Specs handle their own.
- Preserve everything else (webServer auto-start, `video: 'on'`,
  retries on CI, the setup project + chromium project dependency).

**Patterns to follow:**
- Current config's `dotenv.config({ path: '.env.local' })` and env-var
  branching style.

**Test scenarios:**
- Default `pnpm test:e2e` → headless, no slowMo, runs against
  `localhost:5173` with auto-Vite-start.
- `pnpm test:e2e:demo` → headed, `slowMo: 500`.
- `E2E_BASE_URL=https://staging.rackemleagues.com pnpm test:e2e` →
  fails at config-load with the staging-non-localhost error.
- `E2E_BASE_URL=https://staging E2E_REMOTE_OK=true pnpm test:e2e` →
  passes through (escape hatch for the rare smoke-test-staging case).
- `dashboard.spec.ts` (after Unit 3 migration) still passes.

**Verification:**
- All four env-var combinations behave as documented.

---

- [ ] **Unit 5: Test data factories**

**Goal:** Reusable factories that build leagues/seasons/teams/matches
inside the foundation org. One composite shortcut for the common
"match ready for lineup entry" state.

**Requirements:** R7, R8, R9, R10.

**Dependencies:** Unit 1 (foundation users).

**Files:**
- Create: `tests/e2e/fixtures/serviceClient.ts` (copy the relevant lines
  from `src/test/dbTestUtils.ts` — local-only demo JWT only, NOT a real
  service-role key — with a prominent warning comment).
- Create: `tests/e2e/fixtures/factories.ts` (or split into
  `factories/<area>.ts` if any single file grows past ~100 lines per
  the project size target).

**Approach:**
- All factories use the local `serviceClient.ts`. RLS is bypassed
  during setup; tests that exercise user-as-actor behavior drive the
  UI (Units 6–9 do this for lineup → prep → scoring).
- Each factory generates a unique name with timestamp + random suffix:
  `e2e-${YYYY-MM-DD-HHMM}-${nanoid(5)}`.
- `createLeague({ teamFormat = '8_man', lineupSize = 5, maxRosterSize = 8,
  gameGeneration = 'modern', handicapType = 'none', ...overrides })`:
  1. Insert `leagues` row with explicit `team_format` (not derived from
     `lineup_size` — see Key Decisions).
  2. Trigger auto-creates the preferences row (NULL modular fields).
  3. Upsert `preferences` row with modular fields:
     `entity_type='league', entity_id=league.id, lineup_size,
     max_roster_size, game_generation, handicap_type`. Use
     `onConflict: 'entity_type,entity_id'`.
- `createSeason(league, { weeks = 12 })`: `seasons` + `season_weeks`
  rows.
- `createTeam(league, captainUserId, { rosterMembers = [] })`:
  `teams` row + `team_players` rows. Captain flag set on the captain
  row.
- `createMatch(season, home, away)`: insert one `matches` row. Trigger
  auto-creates both `match_lineups` rows. Returns `matches.id`.
- `createMatchReadyForLineup({ homeCaptain, awayCaptain })`:
  composite — creates league (default 5v5/8_man/none), season, two
  teams (each rostered with the captain + 4 placeholder/foundation
  members), one match. Returns `{ league, season, match, homeTeam,
  awayTeam }`. Default state: `matches.status = 'scheduled'`,
  `match_lineups` auto-created and `locked = false`, no `match_games`.

*Note:* there is no `createMatchScoringReady` shortcut. Unit 8 (R18)
drives lineup entry and lock through the UI to set `started_at` (which
the spectate route filters on) and trigger client-side prep. This
matches the "factories end at lineup-ready" boundary documented in
Key Decisions.

**Patterns to follow:**
- `src/wizards/league-v2/useCreateLeagueV2.ts` for the dual-write
  league/preferences pattern.
- `src/wizards/league-v2/presetMappings.ts` for the team_format /
  lineup_size matrix when picking factory defaults.
- `database/dev_bootstrap_full.sql` for column shapes (`season_weeks`
  in particular).

**Test scenarios:**
- Happy path (each factory): row(s) created, foreign keys resolve,
  default values fit schema constraints.
- Idempotency in parallel: invoking `createLeague()` from 2 concurrent
  workers produces 2 distinct uniquely-named leagues; no collisions.
- Schema constraints: `createLeague` writes a non-null `team_format`;
  the modular `preferences` upsert correctly updates the trigger-
  created row (not insert-fail on PK conflict); `createMatch` doesn't
  insert `match_lineups` manually (the trigger does).
- `team_format` parameter: passing `'5_man'` produces a fargo-shaped
  league; default `'8_man'` produces a standard 5v5.
- Composite: `createMatchReadyForLineup` returns a match in
  `status = 'scheduled'` with both `match_lineups` rows present
  (auto-created), no `match_games`, `started_at IS NULL`.

**Verification:**
- A throwaway test that calls each factory + asserts the returned
  shape passes against the foundation.
- `createMatchReadyForLineup` consistently produces a match the
  `MatchLineup.tsx` page renders.

---

- [ ] **Unit 6: `lineup-flow.spec.ts` (R16)**

**Goal:** Single captain enters a full lineup, locks it; opposing
captain (second context) does the same.

**Requirements:** R11, R16.

**Dependencies:** Units 1, 3, 4, 5.

**Files:**
- Create: `tests/e2e/specs/lineup-flow.spec.ts`

**Approach:**
- `createMatchReadyForLineup({ homeCaptain: 'captain-1', awayCaptain:
  'captain-2' })` for setup.
- Default page = captain-1; spawn a second context with
  `getStorageState('captain-2')`.
- Each captain navigates to `/match/${match.id}/lineup`, fills slots,
  hits Lock.
- Assert both `match_lineups.locked = true` after both captains lock.

**Patterns to follow:**
- The existing `MatchLineup.tsx` page (UI selectors).

**Test scenarios:**
- Happy path: both captains lock; assert DB state.
- Edge case: captain unlocks after locking, re-locks; assert DB end
  state.
- Integration: realtime — captain-2's `OpponentLineupCard` reflects
  captain-1's lock state within the realtime window.

**Verification:** spec passes against a freshly-seeded foundation.

---

- [ ] **Unit 7: `double-duty-handoff.spec.ts` (R17)** — held on lineup race-condition merge

**Goal:** Two captains, two contexts; one locks with a double-duty
placeholder; opponent resolves via `OpponentSubstituteModal`. Verify
no `SUB_HOME_ID` / `SUB_AWAY_ID` UUIDs appear in `match_games` after
prep completes.

**Requirements:** R11, R17.

**Dependencies:** Units 1, 3, 4, 5. **Plus the lineup race-condition fix
on `feature/lineup-polish` must be merged.** See "Deferred to Separate
Tasks" for the recommended sequencing (ship Unit 7 inside that branch's
PR).

**Files:**
- Create: `tests/e2e/specs/double-duty-handoff.spec.ts`

**Approach:**
- Setup as in Unit 6, with a roster small enough that double-duty is
  possible.
- captain-1 picks a slot, opens the player Select dropdown, picks the
  "Double Duty" option (synthetic dropdown value `'__double_duty__'`
  per `MatchLineup.tsx`'s `DOUBLE_DUTY_VALUE` constant; the
  `handlePlayerChange` handler parses this into setting the slot's
  player_id to `SUB_HOME_ID` plus `substituteType = 'double_duty'`).
  Then locks. Selector hint: `page.getByRole('combobox')` to open the
  Select, then `page.getByRole('option', { name: /double duty/i })`.
- captain-2's UI surfaces `OpponentSubstituteModal`. Pick a real player.
- After both locked + handoff resolved, `useMatchPreparation` fires
  in-browser on the home client.
- Wait for navigation to `/match/${id}/score`.
- Assert `match_games` rows: `home_player_id != SUB_HOME_ID` AND
  `away_player_id != SUB_AWAY_ID` for every row. (Use the actual
  sentinel values from `src/player/MatchLineup.tsx:55–56` —
  `'00000000-0000-0000-0000-000000000001'` and
  `'00000000-0000-0000-0000-000000000002'`.)

**Patterns to follow:**
- `src/components/lineup/OpponentSubstituteModal.tsx` for selectors.
- `src/hooks/lineup/useMatchPreparation.ts` for expected end state.
- `src/player/MatchLineup.tsx` for sentinel UUIDs.

**Test scenarios:**
- Happy path: handoff completes, no rows in `match_games` carry the
  sentinel UUIDs. **Regression test for the lineup race-condition bug
  class.**
- Edge case: opponent's modal close-without-pick keeps the lineup in
  pre-prep state (no premature `match_games` insert).
- Edge case: home captain unlocks after handoff resolves → lineup
  returns to pre-prep, no zombie `match_games` rows.

**Verification:**
- Spec passes after the lineup race-condition fix is merged.
- Spec FAILS (correctly) if the lineup race-condition fix is reverted
  — the underlying race re-creates the sentinel-UUID rows in
  `match_games`.

---

- [ ] **Unit 8: `scoring.spec.ts` (R18)**

**Goal:** Drive lineup → prep → scoring through the UI; score one rack;
observer (third context) sees the live/spectate route update via
realtime.

**Requirements:** R11, R18.

**Dependencies:** Units 1, 3, 4, 5.

**Files:**
- Create: `tests/e2e/specs/scoring.spec.ts`

**Approach:**
- Use `createMatchReadyForLineup({ homeCaptain: 'captain-1',
  awayCaptain: 'captain-2' })`. **No `createMatchScoringReady`** — the
  UI lineup-lock flow is what sets `matches.started_at`, which the
  spectate route filters on.
- Three contexts: captain-1 (drives lineup → lock → scoring),
  captain-2 (drives the matching lineup-lock), observer (watches
  spectate route at `/league/${league.id}/live`). Lineup entry can be
  fast/programmatic via the same UI selectors used in Unit 6 — wrap
  in a small `lockBothLineupsViaUI(...)` helper local to the spec if
  the steps are repeated.
- After both locked, `useMatchPreparation` fires (home client),
  `match_games` populated, navigation to `/match/${id}/score`.
- captain-1 scores rack 1 (home wins).
- observer's `/league/${league.id}/live` shows the score update within
  the realtime window.

**Patterns to follow:**
- `src/realtime/useMatchRealtime.ts` for channel name (`match_${matchId}`).
- The existing scoring page UI for selectors.
- `src/api/queries/matches.ts::getLiveMatchesForLeague` for the route's
  filter (`started_at IS NOT NULL`).

**Test scenarios:**
- Happy path: rack scored, captain-1 sees it, observer sees it on
  spectate.
- Edge case: realtime delay → assert with a 5s `toBeVisible` wait.
- Integration: scoring updates `matches` totals; observer's spectate
  view reflects.

**Verification:**
- Spec passes. Observer assertion completes within ~5s realtime window.

---

- [ ] **Unit 9: `wizard-tour.spec.ts` (R20)**

**Goal:** Full Create-New-League wizard end-to-end as the LO. Tagged so
`pnpm test:e2e:demo --grep "wizard"` runs only this and its peers.

**Requirements:** R20.

**Dependencies:** Units 1, 3, 4. (No factory dependency — the wizard
itself creates the league.)

**Files:**
- Create: `tests/e2e/specs/wizard-tour.spec.ts`

**Approach:**
- `test.use({ storageState: getStorageState('lo') })`.
- Navigate to the wizard entry point (the LO dashboard's "Create New
  League" affordance).
- Drive each of the 5 stages of "Wizard 2.0" (per recent main commit
  2c1bf8a).
- Assertions at each stage to keep this honest as a regression test;
  pacing comes from `slowMo` in demo mode.
- File name suffix or `test.describe('@tour', ...)` so demo runs can
  filter to tour tests.

**Patterns to follow:**
- The wizard UI in `src/wizards/league-v2/`.

**Test scenarios:**
- Happy path: all 5 stages complete, league exists in DB.
- Edge case: validation error in one stage → user can fix and continue.
- Demo-mode quality (manual): `pnpm test:e2e:demo --grep "wizard"`
  produces a video the project owner reviews and accepts as a raw
  sales-pitch starting point.

**Verification:**
- Spec passes in regression mode.
- Demo-mode video reviewed and accepted by the project owner.
- **Cleanup-before-recording note in README:** for highest-quality
  demo video, run `pnpm e2e:setup` immediately before
  `pnpm test:e2e:demo` so the LO's "my leagues" surfaces are clean
  during the recording.

---

- [ ] **Unit 10: README rewrite + TABLE_OF_CONTENTS update**

**Goal:** Replace the manual `/register` instructions with the new
seed-based, multi-user, factory-driven model. Update the project's TOC.

**Requirements:** R23, R24.

**Dependencies:** Units 1–9 substantially complete (paths and
behaviors stable).

**Files:**
- Rewrite: `tests/e2e/README.md`
- Modify: `TABLE_OF_CONTENTS.md`

**Approach:**
- README sections:
  - One-time setup: install (`pnpm install`), start Supabase
    (`pnpm db:start`), set `.env.local` (`E2E_LOCAL_OK=true` and
    `E2E_PW=<chosen password>`), run `pnpm e2e:setup`.
  - Foundation users: link to `database/e2e_seed.sql` for the seeded
    list and password mechanism (no plaintext duplication).
  - Running tests: regression (`pnpm test:e2e`), single test
    (`pnpm test:e2e -- lineup-flow`), demo mode
    (`pnpm test:e2e:demo --grep "wizard"`).
  - Adding a new test: declare starting user via `getStorageState`,
    use factories, follow the spec layout in `tests/e2e/specs/`.
  - Multi-actor pattern: link to `lineup-flow.spec.ts` and
    `double-duty-handoff.spec.ts` as canonical examples.
  - Demo-video safety note: videos may capture authenticated session
    state and URLs. Review locally before any external sharing. Do
    not open DevTools while recording.
  - Cleanup: tests do not clean up; foundation accumulates throwaway
    leagues. Run `pnpm e2e:setup` periodically (especially before
    recording a demo).
- Remove from README: any references to manual `/register`, the old
  `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` pattern, the staging
  `pnpm test:e2e:staging` command (out of v1 scope; the `package.json`
  may keep it as an undocumented hook for v2, but README doesn't
  mention it).
- TABLE_OF_CONTENTS.md:
  - Add entries for: `database/e2e_seed.sql`, `scripts/e2e-setup.mjs`,
    `tests/e2e/fixtures/users.ts`, `tests/e2e/fixtures/serviceClient.ts`,
    `tests/e2e/fixtures/factories.ts` (or split files), the four new
    `tests/e2e/specs/*.spec.ts` files.
  - Update "Last Updated" date.
  - Add an "End-to-End Testing" entry under "Quick Reference: Find By
    Feature" if applicable.

**Patterns to follow:**
- The current `README.md`'s table-based "Running the tests" section.

**Test scenarios:** none — documentation. (Verified by Success
Criteria's clean-checkout test.)

**Verification:**
- A new contributor following the README from a clean checkout reaches
  a passing `pnpm test:e2e` run.
- TOC accurately reflects the file tree.

---

## System-Wide Impact

- **Interaction graph:** `tests/e2e/auth.setup.ts` (rewritten) is the
  only entry point all specs depend on. Removing project-level
  `storageState` from `playwright.config.ts` means every existing and
  future spec must declare its starting user; Unit 3 migrates
  `dashboard.spec.ts` (the only pre-existing consumer).
- **Error propagation:** failure modes — seed not run (auth setup
  surfaces it), bcrypt hash wrong (auth setup fails fast), env-var
  conflict (Unit 4's startup guard), parallel-worker user collision
  (handle by setting `fullyParallel: false` if observed; documented in
  Open Questions).
- **State lifecycle risks:** foundation accumulates throwaway leagues
  across runs (R21). README documents "run `pnpm e2e:setup` before
  recording demo." Slow page-loads after many runs are an accepted
  v1 cost.
- **API surface parity:** none — local infrastructure, no public API
  shipped.
- **Integration coverage:** Units 7 + 8 cross multiple layers
  (UI + Realtime + DB). `match_games` realtime channel is exercised.
  No factory tries to mirror `useMatchPreparation`'s game-row insert
  shape — the UI flow does it (via Unit 8 driving lineup-lock through
  the UI).
- **Unchanged invariants:** `tests/e2e/auth.setup.ts` signature
  changes (now multi-user); the single-user `tests/e2e/.auth/user.json`
  goes away (per-user files take over); production app behavior is
  untouched.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Bcrypt hash chosen in Unit 1 doesn't authenticate against GoTrue. | Unit 1 includes a verification scenario; Unit 3 will fail loudly if the hash is wrong. Generate the hash with `bcrypt-cli` (cost factor 10, `$2a$` prefix) and test against the Supabase auth client before declaring Unit 1 done. |
| `organization_staff` trigger doesn't populate correctly under service-role insert. | Unit 1 verifies during implementation; if not, falls back to manual `INSERT INTO organization_staff`. Without this, R20 (LO wizard tour) fails at the first wizard guard. |
| Parallel workers cause user-role collisions when one foundation user is captain on multiple simultaneous throwaway leagues. | Run R16 + R17 (or R16 twice) concurrently against a clean DB during Unit 6+7 verification. If collisions occur, set `fullyParallel: false` in `playwright.config.ts` for v1; v2 can revisit with per-test ephemeral users. |
| Unit 7 (R17) cannot pass until the lineup race-condition fix on `feature/lineup-polish` lands. | **Recommended:** ship Unit 7 inside `feature/lineup-polish`'s PR. Otherwise: ship Units 1–6 + 8–10 here, hold Unit 7 as a follow-up PR after the fix merges. If the fix is superseded, re-evaluate Unit 7's specific assertion against whatever shipped. |
| `tsconfig.app.json` excludes `src/test/`, blocking import of `createServiceClient`. | Resolved by Key Decision — `serviceClient.ts` is local to `tests/e2e/fixtures/`, not imported from `src/`. |
| Demo-mode video captures authenticated session details (URLs, cookies in DevTools overlay). | R15 and Unit 10 require the README to flag this. Reviewer checklist before any external sharing. Do not open DevTools while recording. |
| `system_player_number` collisions if seed runs against a DB already containing 200001+. | Cleanup DELETE block in Unit 1 removes any `e2e-` rows first. If a non-`e2e-` row uses 200001+, the conflict surfaces immediately and the developer chooses a different range. |
| `E2E_REMOTE_OK=true` is documented as a "rare smoke-test-staging" escape hatch but has no scope restriction — pointing it at a production URL would run destructive DELETE-by-`e2e-`-prefix queries against production data. | During implementation, restrict the Unit 4 guard's escape clause to URLs whose hostname matches a staging-domain pattern (e.g., `.includes('staging')` or a regex), OR document loudly in `.env.example` and the README that `E2E_REMOTE_OK=true` must NEVER be combined with a production URL. The recommended Unit 2 change (remove `test:e2e:staging` for v1) reduces but does not eliminate this risk. |
| Pre-existing plaintext password "test-password-123" in `supabase/seed_test_users.sql` and `src/test/dbTestUtils.ts` is tech debt this plan does not remediate. | Out of scope for v1. Track as a follow-up: rotate that password and move it to `.env.local` after this plan ships. The new E2E foundation deliberately uses a distinct password sourced from `.env.local` so it does not extend the existing plaintext footprint. |
| The login UI is exercised every auth-setup run (UI login per user). If the login form changes (selectors, route), auth setup breaks first. | Acceptable v1 cost. Easier-to-debug failure than a silent storage-state corruption. |
| Foundation users accumulate cross-league memberships over time. | `pnpm e2e:setup` cascades through all `e2e-` leagues + the foundation org, fully resetting the user pool's relationships. Running setup periodically resolves any drift. |

## Documentation / Operational Notes

- `tests/e2e/README.md` (Unit 10) is the runtime documentation surface.
- `TABLE_OF_CONTENTS.md` (Unit 10) is the project-wide index.
- `.env.example` (Unit 1/2) gains commented `E2E_PW=` and
  `E2E_LOCAL_OK=true` entries.
- After this lands: a `/ce-compound` pass is recommended to capture
  (a) the bcrypt-hash format that authenticated against GoTrue, and
  (b) any multi-context Playwright + Supabase Realtime pitfalls
  surfaced during Units 7–8.

## Sources & References

- **Origin document:** [docs/brainstorms/e2e-test-infrastructure-requirements.md](../brainstorms/e2e-test-infrastructure-requirements.md)
- **Lineup race-condition origin (Unit 7 dependency):** [docs/brainstorms/lineup-race-condition-fix-requirements.md on `feature/lineup-polish`](https://github.com/jacked-apps/rackem-leagues/blob/feature/lineup-polish/docs/brainstorms/lineup-race-condition-fix-requirements.md)
- **Related code (verified during research):** `playwright.config.ts`,
  `tests/e2e/auth.setup.ts`, `tests/e2e/dashboard.spec.ts`,
  `tests/e2e/README.md`, `supabase/seed_test_users.sql`,
  `database/dev_bootstrap_full.sql`, `src/test/dbTestUtils.ts`,
  `src/wizards/league-v2/useCreateLeagueV2.ts`,
  `src/wizards/league-v2/presetMappings.ts`,
  `src/api/hooks/useResolvedLeaguePrefs.ts`,
  `src/hooks/lineup/useMatchPreparation.ts`,
  `src/hooks/lineup/useLineupPersistence.ts`,
  `src/realtime/useMatchRealtime.ts`,
  `src/api/queries/matches.ts`,
  `src/navigation/NavRoutes.tsx`,
  `src/components/ProtectedRoute.tsx`,
  `src/player/MatchLineup.tsx` (sentinel UUIDs at lines 55–56),
  `src/components/lineup/OpponentSubstituteModal.tsx`.
- **Related migrations:**
  `supabase/migrations/20251130010824_baseline.sql`
  (lines 1348 `team_format` NOT NULL, 1829-1853 organizations NOT NULL
  fields, 2840 `trigger_create_league_preferences`),
  `supabase/migrations/20260418000002_lock_tier1_preferences.sql`.
- **Related PRs:** PR #78 (Playwright bootstrap, on main); the lineup
  race-condition fix (currently on `feature/lineup-polish`).
