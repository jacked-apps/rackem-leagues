---
title: E2E Test Infrastructure
date: 2026-04-27
status: Requirements — ready for planning
scope: Playwright test infrastructure for local Supabase. v1 covers the
  foundation, factories, multi-user auth setup, and 4 starter scenarios. Cross-
  org tests, the same-team scoring race test, and staging mode are deferred to
  v2 expansions to keep v1 deliverable for one engineer.
---

# E2E Test Infrastructure

## Problem Frame

PR #78 landed Playwright E2E with a single user, a UI-driven login fixture, and
one example test (`tests/e2e/dashboard.spec.ts`). The recent lineup race-
condition work (in-flight on `feature/lineup-polish`; see
`docs/brainstorms/lineup-race-condition-fix-requirements.md` on that branch)
shipped from manual two-browser testing — and that experience exposed how
brittle the current setup is for anything beyond a single-user smoke. There is
no shared test sandbox, no test-data factories, no multi-actor pattern, and no
isolation between tests, so every new spec would re-invent setup from scratch.

This brainstorm defines the **infrastructure scaffolding** that turns "write an
E2E test" into a small, repeatable task — for regression coverage and for raw
demo video usable as a sales-pitch starting point with light post-production.
The lineup race-condition flow is one prototypical scenario we want supported,
not the scope of the work.

## Goals

1. Adding a new E2E test for any future feature is cheap — small, focused tests
   are typically a few dozen lines on top of existing factories.
2. Tests cannot poison each other's state — each runs against its own
   freshly-created league inside a stable shared sandbox.
3. Multi-actor flows (2+ simultaneous logins, e.g., double-duty handoff,
   spectator observing scoring) are expressible in one test file.
4. The same suite produces raw demo video via a "human mode" run flag — usable
   for sales reels with light post-production (cuts, captions, voiceover happen
   outside this system).
5. Test setup is reproducible from a clean checkout: one command (`pnpm
   e2e:setup`) builds the entire sandbox; one command (`pnpm test:e2e`) runs.

## Non-Goals

- Running tests against staging in v1.
- Running tests against production. Ever.
- Replacing existing Vitest unit / integration / RLS test suites under
  `src/__tests__/` and `database/tests/`.
- Visual regression testing (pixel diffs).
- CI integration — local-only for v1; CI is a follow-up.
- A polished, edited sales reel — Playwright produces raw video; music,
  voiceover, and cuts happen in post-production outside this system.
- Cross-org / multi-org tests in v1 (foundation is single-org; second org is a
  one-section extension when the first cross-org test is written).
- Same-team scoring race regression test (deferred until the app's same-rack
  conflict-resolution behavior is defined separately).

## Target Users

- **Primary:** the project's developers (currently 1 junior engineer + partner)
  writing tests for new features and verifying regressions before shipping.
- **Secondary:** the project owner producing sales/sponsor demo videos that
  showcase real, working app behavior at watchable speed.

## Architecture: The Sandbox Model

```
┌─────────────────────────────────────────────────────────────────┐
│ FOUNDATION  (built once by database/e2e_seed.sql)               │
│                                                                 │
│   Test Org (single-org for v1; second org is a v2 extension)    │
│   ├ LO: e2e-lo                                                  │
│   └ (members, base venue)                                       │
│                                                                 │
│   Shared user pool (5 logins):                                  │
│     e2e-captain-1, 2, 3      (3 captains/scorekeepers)          │
│     e2e-observer             (no team affiliation, spectator)   │
│     (e2e-captain-4 added when R19 revives in v2)                │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ FACTORIES  (called by tests; tests/e2e/fixtures/)               │
│   createLeague(prefs?)                                          │
│   createSeason(league, weeks?)                                  │
│   createTeam(league, captainUserId, members?)                   │
│   createMatch(season, home, away)                               │
│   createMatchReadyForLineup({ captains })  ← composite          │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TESTS  (tests/e2e/specs/)                                       │
│   regression/  — small, focused, parallel, headless             │
│   tour/        — long, narrated, also runnable in human mode    │
└─────────────────────────────────────────────────────────────────┘
```

Each test creates its own throwaway league inside the foundation (uniquely
named, e.g. `e2e-2026-04-27-1647-x9k`), runs, and exits. Foundation users and
the test org never mutate. Re-running `pnpm e2e:setup` rebuilds foundation +
clears throwaways.

Team and captain roles (which user captains which team, which two users co-
score on the same team) are **assigned by factories per test**, not baked into
foundation seats. The user palette describes which users are *available* and
the kind of role they typically play; factories wire the relationships into
each test's throwaway league.

## Foundation: User Palette

| Login (suggested local) | Typical role applied by factories | Used for |
|---|---|---|
| `e2e-lo@test.test` | League Operator | Wizard tour, league setup tests |
| `e2e-captain-1@test.test` | Captain (home team) | Single-captain flows, lineup-flow |
| `e2e-captain-2@test.test` | Captain (away team) | Double-duty handoff, opposing-team flows |
| `e2e-captain-3@test.test` | Reserve captain | Used when a third independent context is needed |
| `e2e-observer@test.test` | No team affiliation (members row exists, no team_member row) | Authenticated spectator route |

`e2e-captain-4` is added in v2 when R19 (same-team scoring race) is implemented.

Login addresses use the `.test` reserved TLD so they cannot route real email.
Passwords are a single shared known value defined as a comment in the seed
file (`database/e2e_seed.sql`); `tests/e2e/README.md` links to that file
rather than duplicating the plaintext.

## Requirements

**Sandbox & seeding**
- **R1.** A new `database/e2e_seed.sql` script builds the full v1 foundation
  (one Test Org, 5 users, base members, base venue) from a clean local DB.
  Idempotent (can be re-run safely). Adding a second org is a one-section
  extension when the first cross-org test is written. The observer user gets
  a `members` row (required by `withMember`/`ProtectedRoute` to reach the
  spectate route) but no `team_members` row.
- **R2.** The seed script is dev-only and refuses to run unless an explicit
  `E2E_LOCAL_OK=true` environment variable is set in the seeding shell. (A
  database-name check matching `dev_bootstrap_full.sql`'s pattern is also
  retained for consistency, but it is not load-bearing — hosted Supabase
  projects also use database name `postgres`, so the env var is the actual
  gate.) Planning may add a localhost connection-host assertion (e.g., port
  54322 / `127.0.0.1`) for a true second guard if low-cost.
- **R3.** A `pnpm e2e:setup` command runs the seed end-to-end, including any
  necessary cleanup of prior throwaway data. (Specific latency target deferred
  to planning, since it depends on the cleanup mechanism chosen there.)
- **R4.** The seed script does not collide with `supabase/seed_test_users.sql`
  (which serves RLS unit tests). E2E users use a clear `e2e-` prefix.

**Test user model**
- **R5.** All foundation users are created by the seed script (auth row +
  members row), not by manual `/register` flow, so a fresh checkout reaches
  testable state without manual signups. The shared password and bcrypt hash
  are an explicit accepted tradeoff for local-only v1; both are committed to
  the seed file with a comment explaining this and require re-evaluation
  before any future staging mode (see Future expansion). The E2E password is
  **distinct** from the password in `supabase/seed_test_users.sql` so the two
  test populations are not credential-equivalent.
- **R6.** Users are pre-confirmed (`email_confirmed_at` set) so the login flow
  works without email-verification UI.

**Test data factories**
- **R7.** Reusable factory helpers (`createLeague`, `createSeason`,
  `createTeam`, `createMatch`, plus 1–2 composite shortcuts) live under
  `tests/e2e/fixtures/` and are importable from any spec.
- **R8.** Each factory accepts optional overrides but fills sensible defaults
  so a test can call `createLeague()` and immediately work.
- **R9.** All factories must write the resolved-preferences row
  (`handicap_type`, `lineup_size`, `max_roster_size`, `game_generation`) for
  every league they create. New factory code must not **branch on**
  `team_format`, `'5_man'`, or `'8_man'`. Note: the `leagues.team_format`
  column is currently `NOT NULL` in the schema, so factories will continue
  to write a value to that column (matching what `useCreateLeagueV2.ts`
  already does) until a separate migration relaxes the constraint. R9's
  intent is to forbid new logic that *reads* `team_format`, not to forbid
  *setting* it. (Inherited architectural constraint — see
  `docs/brainstorms/lineup-race-condition-fix-requirements.md` on the
  `feature/lineup-polish` branch.)
- **R10.** Each test's throwaway league name is unique (timestamp + random
  suffix) so concurrent test runs and parallel workers within a single run
  cannot collide.

**Multi-actor support**
- **R11.** A test can spin up 2+ pre-authenticated browser contexts in a
  single test file (different users, parallel actions, shared match). The
  pattern is documented and used by at least one starter scenario.
- **R12.** Each foundation user has its own pre-saved storage state file
  (`tests/e2e/.auth/<user>.json`), seeded once per run by a multi-user auth
  setup step that **replaces** the existing single-user `auth.setup.ts` from
  PR #78. The single-user `storageState` line in `playwright.config.ts` is
  removed; specs declare their starting user via `test.use({ storageState })`
  (typed helper preferred). The existing `dashboard.spec.ts` is migrated to
  use a foundation user.

**Run modes (regression vs. demo)**
- **R13.** *(Preserve existing.)* `pnpm test:e2e` continues to run headless,
  parallel, with `video: 'on'`. The current `playwright.config.ts` already
  covers this.
- **R14.** A new `pnpm test:e2e:demo` script enables demo mode via
  `E2E_DEMO=1` read by `playwright.config.ts`, which then sets
  `use.launchOptions.slowMo: 500` and `use.headless: false`. Same source code,
  no separate config file. Demo runs typically target a filtered subset
  (e.g., the wizard-tour test) via Playwright's `--grep`.
- **R15.** *(Preserve existing.)* The video Playwright already captures in
  regression mode is a debugging aid; the video captured in demo mode is the
  raw artifact for post-production. Demo-mode videos may capture
  authenticated session details (URLs, network traffic in DevTools overlays
  if open). README must warn that demo-mode videos are reviewed before
  external sharing.

**Test design (starter scenarios — validate the pattern)**
- **R16.** A `lineup-flow.spec.ts` test covers a single captain entering a
  full lineup, locking it, and (via a second context) the opposing captain
  doing the same.
- **R17.** A `double-duty-handoff.spec.ts` test covers two captains in two
  contexts: one locks a lineup with a double-duty placeholder; the other
  resolves it via the `OpponentSubstituteModal`. Verifies no "Unknown" rows
  appear in `match_games` — the bug class fixed by the in-flight lineup
  race-condition work.
- **R18.** A `scoring.spec.ts` test covers scoring at least one rack from a
  prepared match and verifying the live/spectate route updates as seen by an
  authenticated non-team-member (`e2e-observer`).
- **R19.** *(Deferred from v1.)* A `same-team-scoring-race.spec.ts` test would
  run 2 contexts on the same team attempting to score the same rack
  simultaneously. **Deferred** because the app's conflict-resolution behavior
  for simultaneous same-rack writes is not yet defined; defining that
  behavior is its own ticket. Once defined, this test is a small follow-up on
  top of the existing factories.
- **R20.** A `wizard-tour.spec.ts` test runs the full Create-New-League
  wizard end-to-end as the LO. Doubles as raw demo video when run in demo
  mode. Sales-pitch usability is post-production-dependent (cuts of factory
  setup, captions over throwaway league name, etc.) — not a turnkey reel.

**Cleanup model**
- **R21.** Local sandbox: tests do **not** clean up their throwaway leagues.
  Names are unique; clutter is harmless on a sandbox DB; leftover state aids
  debugging a failed test. `pnpm e2e:setup` blows everything away on the next
  run, and developers are expected to run it periodically (e.g., before each
  test session) to keep the foundation responsive.
- **R22.** *(Deferred to v2 staging mode.)* Factories will gain a
  `cleanupOnTeardown` option **when staging support is added**, so staging can
  flip it without changing test code. v1 does not add this option — no
  consumer.

**Documentation**
- **R23.** `tests/e2e/README.md` is **rewritten** to replace the current
  manual-`/register` instructions. Coverage: the sandbox model, the user
  palette, how to run tests, how to run in demo mode, how to add a new test,
  the multi-actor pattern, and the explicit acknowledgment that test
  passwords + hashes live in `database/e2e_seed.sql` for local-only use.
- **R24.** `TABLE_OF_CONTENTS.md` is updated with new files (per project
  rules).

## Success Criteria

- A developer (you) can clone the repo on a fresh machine, run two commands
  (`pnpm e2e:setup` and `pnpm test:e2e`), and see the full suite pass.
- **Each foundation user can authenticate via the app login UI with the
  password defined in the seed.** This is a hard gate on R5: if the bcrypt
  hash chosen during planning does not actually authenticate, R5 is not done.
- Adding a new test for a future feature is dominated by writing the actual UI
  assertions, not by setup boilerplate. Setup is a few lines of factory calls.
- The double-duty handoff flow is covered by an automated test that would
  have caught the lineup race-condition bug class.
- A demo-mode run of `wizard-tour.spec.ts` produces raw video the project
  owner finds usable as a sales-pitch starting point with light post-
  production (cuts, captions, voiceover).
- No test ever fails because a previous test left dirty state.

## Scope Boundaries

**In scope (v1):**
- Local-Supabase-only test runs.
- Single Test Org foundation with 6 seeded users.
- The 4 starter scenarios in R16, R17, R18, R20 (R19 deferred).
- Factory layer + foundation seed + multi-user auth setup that replaces the
  PR #78 single-user model.
- Demo run mode via `E2E_DEMO=1`.

**Explicitly out of scope (v1):**
- Staging or production test runs.
- A polished sales reel pipeline (music, captions, cuts) — Playwright outputs
  raw video; post-production happens elsewhere.
- A dedicated hosted "demo" Supabase environment.
- CI integration (GitHub Actions running the suite on every PR).
- Coverage reports / metrics.
- Tests for legacy `team_format` / `'5_man'` / `'8_man'` paths — new code
  must use resolved preferences, so test surface follows.
- Cross-org tests, Org B foundation seat, `e2e-multi-org` user (added when
  the first cross-org test is written).
- Same-team scoring-race regression test (R19, deferred).

**Future expansion (documented, not built):**
- **Staging test mode** with selective cleanup. Foundation persists; throwaway
  leagues clean up after themselves; env banner hidden in demo mode. The
  `cleanupOnTeardown` factory option (referenced in earlier drafts of this
  doc) is added in this expansion, not in v1. Before this ships, the seed's
  password mechanism must be re-evaluated — local v1 commits a known password,
  which is acceptable for local but not for staging.
- **Cross-org / multi-org tests.** Adds Org B and `e2e-multi-org` user to the
  foundation seed, plus the first cross-org-isolation test as a witness.
- **Same-team scoring-race test (R19) revival.** Requires a separate ticket
  defining the app's same-rack conflict-resolution behavior first.
- **Dedicated hosted demo environment** for polished sales videos (separate
  Supabase project literally named "demo," not staging/prod).
- **CI smoke tests** on PR merge.

## Key Decisions

- **Per-test fresh league inside a persistent single-org sandbox** for v1
  (Org B and `e2e-multi-org` deferred). Bulletproof isolation; foundation is
  extensible.
- **Mostly small focused tests + 1 long "tour" test** (R20 wizard-tour). Tour
  test doubles as raw demo video in demo mode; light post-production turns it
  into a sales reel.
- **Bake foundation users into the seed script** (not manual `/register`).
  Reproducible from a clean checkout. Shared password is an explicit local-
  only tradeoff.
- **Local-only for v1; staging deferred.** Set up front so scope does not
  creep mid-implementation.
- **Multi-user auth setup replaces the existing single-user PR #78 model.**
  Not an extension. The single-user `auth.setup.ts` and the project-level
  `storageState` in `playwright.config.ts` go away; specs declare their
  starting user explicitly.
- **R19 (same-team scoring race) deferred.** Cannot be a passing regression
  test until the app's same-rack conflict-resolution behavior is defined
  separately.
- **Sales-grade is post-production-light, not turnkey.** Demo mode produces
  watchable raw video; cuts/captions/voiceover happen outside this system.
- **No production tests, ever.** Sales videos use the local sandbox in demo
  mode (or a future dedicated demo Supabase project — v2).
- **Factories key off resolved preferences.** Inherits the lineup-race-fix
  architectural constraint — no `team_format` discriminators in new code.
- **Roles are per-test, not per-foundation-seat.** Foundation users are a
  *pool* of available logins; factories assign team/captain relationships
  per test. The palette's "Typical role" column is descriptive, not
  prescriptive.
- **Opt-in env var (`E2E_LOCAL_OK=true`) is the real seed-script guard.**
  The database-name check is retained for consistency with
  `dev_bootstrap_full.sql` but is not load-bearing alone (hosted Supabase
  also uses `postgres`). Planning may add a localhost connection-host
  assertion as a true second guard if low-cost.

## Dependencies / Assumptions

- Local Supabase is already in use for development and supports running
  arbitrary SQL via the Studio SQL editor or `psql`.
- The existing Playwright setup (PR #78 — `playwright.config.ts`,
  `tests/e2e/auth.setup.ts`, `tests/e2e/dashboard.spec.ts`) is **replaced**,
  not extended: the multi-user model requires it. `playwright.config.ts`
  retains its env-var driving and `webServer` config; the auth setup, project-
  level `storageState`, and `dashboard.spec.ts`'s legacy auth path are
  rewritten.
- The app's live/spectate routes (e.g., `league/:leagueId/live`) are reachable
  by any authenticated member, with or without a team affiliation. Verified
  in the document review (`src/navigation/NavRoutes.tsx` wraps these in
  `withMember` rather than a public route).
- The current data model supports two team members both having score-entry
  permission, in some form (assumed; verify in planning — see Outstanding
  Questions).

## Outstanding Questions

### Resolve Before Planning

(none — product decisions are settled)

### Deferred to Planning

- **[Affects R5][Technical]** Exact mechanism for seeding `auth.users` rows
  with a known password — generate bcrypt hash inline (preferred for v1),
  reuse the existing `supabase/seed_test_users.sql` hash (only after
  independently verifying it actually bcrypt-matches its claimed plaintext),
  or call a Supabase admin API. The bcrypt-verification gate is now in
  Success Criteria, so the chosen mechanism must be exercised by an actual
  UI login before R5 is closed.
- **[Affects R3][Technical]** What "cleanup of prior throwaway data" means
  in `pnpm e2e:setup` — TRUNCATE specific tables, full `supabase db reset`
  followed by re-seed, or targeted DELETE WHERE name LIKE 'e2e-%'. Choose
  during planning based on Supabase reset speed.
- **[Affects R7, R10][Technical]** Whether factories interact with Supabase
  via direct SQL (service-role client) or via the app's Supabase JS client.
  Service-role bypasses RLS and is faster; app-client exercises real
  permissions. Likely some of each. Plus: where the service-role key lives
  at runtime and whether it's covered by the `.env.local` gitignore pattern.
- **[Affects R11, R12][Technical]** Multi-user auth setup pattern — one
  parameterized setup file iterating the palette, or N setup files. Pick
  during planning.
- **[Affects R19 v2 revival only][Needs research]** Whether the role/
  permissions model lets two members of the same team both have score-entry
  permission (i.e., an explicit "co-captain" or "scorekeeper" role exists,
  or captain is a per-member flag). Does **not** block any v1 starter
  scenario — R16/R17/R18 use captains on different teams. If unsupported,
  R19's v2 revival will need an app-side change first.
- **[Affects R7, R10][Technical]** Whether a single foundation user (e.g.,
  `e2e-captain-1`) can hold the captain role on multiple throwaway leagues
  simultaneously without app-level breakage (e.g., "my teams" lists, captain
  dashboards). Required for parallel-worker safety since `playwright.config.ts`
  has `fullyParallel: true`.

## Next Steps

`-> /ce:plan` for structured implementation planning.
