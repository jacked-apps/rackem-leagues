# End-to-End Browser Tests

Playwright-based browser tests for the rackem-leagues app. Local-only
(v1). Two purposes:

- **Regression coverage** — catches bugs in captain / LO / observer
  flows before they ship.
- **Raw demo video** — `pnpm test:e2e:demo --grep wizard-tour` produces
  watchable video usable as a sales-pitch starting point or in-app
  tutorial seed (with light post-production: cuts, captions, voiceover).

The scaffolding is designed so that **future plans can include "do test
stuff" as a unit and have it materially mean "compose factories + drive
UI in 10–30 lines per spec."**

## Quick start (one-time setup)

1. **Add two lines to `.env.local`** (gitignored, in the repo root):

   ```
   E2E_PW=<password — see below>
   E2E_LOCAL_OK=true
   ```

   `E2E_PW` is the foundation users' shared password. Ask the team
   channel for the current value (it lives in `.env.local` only,
   never committed). The bcrypt hash committed in
   `database/e2e_seed.sql` was generated for this value.

2. **Make sure local Supabase is running:**

   ```
   pnpm db:start
   ```

3. **Build the test foundation** (creates a test org + venue + 5 users
   inside your local Supabase):

   ```
   pnpm e2e:setup
   ```

4. **Run the suite:**

   ```
   pnpm test:e2e
   ```

That's it. The setup project drives UI login for all 5 foundation
users, saves per-user storage states, and the suite runs.

## Foundation users

Five logins, all sharing `E2E_PW`. Created by `database/e2e_seed.sql`,
visible to specs via `tests/e2e/fixtures/users.ts`.

| Key | Email | Typical role | Use for |
|---|---|---|---|
| `lo` | `e2e-lo@test.test` | League Operator | Wizard tour, LO-side tests |
| `captain-1` | `e2e-captain-1@test.test` | Captain (home team) | Single-captain flows |
| `captain-2` | `e2e-captain-2@test.test` | Captain (away team) | Opposing-side context |
| `captain-3` | `e2e-captain-3@test.test` | Reserve captain | 3rd browser context |
| `observer` | `e2e-observer@test.test` | No team affiliation | Spectator / live-view tests |

Roles labeled "typical" because team / captain / roster relationships
are wired up by **factories per test**, not baked into the foundation.

## Run modes

| Command | What it does |
|---|---|
| `pnpm test:e2e` | Default. Headless, parallel, against local dev (auto-starts Vite). |
| `pnpm test:e2e:demo` | Headed + slow-motion (500ms). Used for demo recording. |
| `pnpm test:e2e:headed` | Default suite, headed (debugging aid). |
| `pnpm test:e2e:ui` | Playwright's interactive UI. |
| `pnpm test:e2e:report` | Open the HTML report from the last run. |
| `pnpm e2e:setup` | Rebuild the test foundation (run after schema changes or to clean up throwaway leagues). |
| `pnpm e2e:verify-auth` | Smoke-check: confirm the bcrypt hash authenticates the foundation users. |
| `pnpm e2e:verify-factories` | Smoke-check: confirm each factory creates the expected DB rows. |

## Recording a demo video

```
pnpm e2e:setup                          # clean foundation = clean recording
pnpm test:e2e:demo --grep wizard-tour   # headed + slowMo, video on
```

The video lands under `test-results/<spec>/video.webm`. **Review locally
before any external sharing** — videos may capture URLs and other
session details visible to the browser. Don't open DevTools during a
recording.

## Adding a new test

The pattern (single captain):

```ts
import { test, expect } from '@playwright/test';
import { getStorageState } from '../fixtures/users';
import { createMatchReadyForLineup } from '../fixtures/factories';

test.use({ storageState: getStorageState('captain-1') });

test('captain does X', async ({ page }) => {
  const { match } = await createMatchReadyForLineup({
    homeCaptain: 'captain-1',
    awayCaptain: 'captain-2',
  });
  await page.goto(`/match/${match.id}/lineup`);
  // drive the UI, assert what should happen
});
```

The pattern (multi-actor — different users in different browser contexts):

```ts
test('two captains coordinate', async ({ browser }) => {
  const { match } = await createMatchReadyForLineup({
    homeCaptain: 'captain-1',
    awayCaptain: 'captain-2',
  });

  const homeContext = await browser.newContext({
    storageState: getStorageState('captain-1'),
  });
  const awayContext = await browser.newContext({
    storageState: getStorageState('captain-2'),
  });
  const homePage = await homeContext.newPage();
  const awayPage = await awayContext.newPage();

  // homePage and awayPage are logged in as different users; drive
  // each independently and assert what each one sees.
});
```

**Reference examples to copy from:**

- `tests/e2e/specs/lineup-flow.spec.ts` — single-captain pattern
- `tests/e2e/specs/wizard-tour.spec.ts` — LO + multi-stage tour (also
  the demo-recording target)
- `tests/e2e/dashboard.spec.ts` — simplest possible spec (page renders)

## Available factories

In `tests/e2e/fixtures/factories.ts`. All return the row(s) they
created. Defaults are sensible; pass overrides only when you need them.

| Factory | What it builds |
|---|---|
| `createLeague(opts?)` | One `leagues` row + modular `preferences` row (defaults: standard 5v5, no handicap). |
| `createSeason(leagueId, opts?)` | One `seasons` row + N `season_weeks` rows (default 12 weeks). |
| `createTeam(leagueId, seasonId, captainKey, opts?)` | One `teams` row + `team_players` row for the captain. |
| `createMatch(seasonId, weekId, homeId, awayId)` | One `matches` row. The auto-create-match-lineups trigger fires automatically. |
| `createMatchReadyForLineup({ homeCaptain, awayCaptain })` | Composite shortcut: full league/season/teams/match chain ready for the lineup-entry UI. |

## How authentication works

`auth.setup.ts` runs once before the main suite (Playwright "setup"
project). It iterates the foundation user palette, drives the login
UI for each one, and saves a per-user storage state under
`tests/e2e/.auth/<key>.json`. Specs declare which user they start as
via `test.use({ storageState: getStorageState('<key>') })`.

UI-driven login is intentional — it also smokes the login form as a
side effect. Cost: ~7-15s once per test run.

## Cleanup model

Tests **do not** clean up their own throwaway leagues. Foundation
artifacts (org, venue, users) accumulate cross-test relationships
across runs. To reset:

```
pnpm e2e:setup
```

This deletes everything attached to the E2E Test Org (every throwaway
league + their teams/matches/lineups), then re-inserts the foundation.
Run it before recording a demo video, or any time the suite feels
sluggish.

## Where outputs live

After a run:

- `test-results/` — per-test folders with `video.webm`, screenshots
  (on failure), and trace files. Gitignored.
- `playwright-report/` — HTML report (open with `pnpm test:e2e:report`).
  Gitignored.
- `tests/e2e/.auth/` — per-user storage states (regenerated each run by
  `auth.setup.ts`). Gitignored.

## What's NOT in v1

These are documented in the brainstorm + plan but deferred to follow-up
work:

- **Staging or production runs.** v1 is local-only. Trying to point the
  suite at staging will throw at config-load (`E2E_BASE_URL` non-
  localhost requires explicit `E2E_REMOTE_OK=true`).
- **CI integration.** Local-only; CI is a v2 plan.
- **Cross-org / multi-org tests.** Foundation is single-org; second org
  added when first cross-org test is written.
- **Same-team scoring race test (R19).** Defers until the app's
  conflict-resolution behavior for simultaneous same-rack writes is
  defined.
- **`double-duty-handoff.spec.ts`.** Will ship inside the lineup race-
  condition fix's PR (`feature/lineup-polish`) so the regression test
  ships with the fix it covers.
- **`scoring.spec.ts` (with spectator).** Add when the first scoring or
  spectate-route regression test is actually needed; the scaffolding
  already supports the third-context observer pattern.

## Plan / brainstorm references

The architecture and decisions behind this scaffolding are documented in:

- `docs/brainstorms/e2e-test-infrastructure-requirements.md`
- `docs/plans/2026-04-27-001-feat-e2e-test-infrastructure-plan.md`

When extending the scaffolding (new factories, new foundation users,
v2 staging mode), update those docs alongside the code.
