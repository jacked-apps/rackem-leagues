# End-to-End Browser Tests

Playwright-based browser tests. Drive a real Chrome, record video of
every run, and save screenshots/traces on failure. Useful for:

- Regression protection on critical user flows (captain flows, scoring,
  dashboard rendering)
- Producing demo reels for sponsor/BCA pitches — the videos under
  `test-results/` after each run are playable in any video player
- Smoke-testing a deployed environment (local, staging, or prod)

## One-time setup

### 1. Create a test user

Create a dedicated test account on whichever environment you plan to
test against. **Do not use your real account.** A test user keeps the
suite deterministic and avoids polluting your real data.

- **Local:** sign up via `/register` while running `pnpm dev`
- **Staging:** sign up at `https://staging.rackemleagues.com/register`

### 2. Put credentials in `.env.local` (gitignored)

Create `.env.local` in the repo root with:

```
E2E_TEST_EMAIL=your-test-user@example.com
E2E_TEST_PASSWORD=your-test-password
```

This file is gitignored and never committed. See `.env.example` for the
template.

## Running the tests

| Command | What it does |
|---------|--------------|
| `pnpm test:e2e` | Run all E2E tests against local dev (auto-starts `pnpm dev`) |
| `pnpm test:e2e:headed` | Same, but with a visible browser window |
| `pnpm test:e2e:ui` | Open Playwright's interactive UI debugger |
| `pnpm test:e2e:staging` | Run against `https://staging.rackemleagues.com` (no dev server) |
| `pnpm test:e2e:report` | Open the HTML report from the last run |

To point at any other URL:

```
E2E_BASE_URL=https://example.com pnpm test:e2e
```

## Where the outputs live

After a run:

- `test-results/` — per-test folders containing video.webm, screenshots
  (on failure), and trace files
- `playwright-report/` — HTML report (open with `pnpm test:e2e:report`)
- `tests/e2e/.auth/user.json` — saved login state (regenerated each run
  by `auth.setup.ts`; never commit)

All three paths are gitignored.

## How authentication works

`auth.setup.ts` runs once before the main test suite. It drives the
login form (email, password, Login button) with the credentials from
`.env.local`, waits for the redirect to `/dashboard`, then saves the
cookies + localStorage to `.auth/user.json`.

Main tests declare `dependencies: ['setup']` in `playwright.config.ts`
and load `storageState: 'tests/e2e/.auth/user.json'` so they start
pre-authenticated. No test has to type the password again.

## Adding new tests

1. Drop a `*.spec.ts` file under `tests/e2e/`
2. Import `{ test, expect } from '@playwright/test'`
3. Write tests — they start already logged in

For a logged-out test (e.g., the public home page), use
`test.use({ storageState: { cookies: [], origins: [] } })` at the top
of the file to override the saved state.

## The lineup-demo spec

`lineup-demo.spec.ts` walks one captain through filling out a Fargo
5v5 lineup with a Double Duty pick, demonstrates the new pre-lock
banner, and confirms the Lock button activates once Fargo ratings
are entered. Doubles as a sales/demo asset — the recorded
`video.webm` under `test-results/` is shareable as-is.

### Extra prerequisite: a known match ID

Add to `.env.local`:

```
E2E_TEST_MATCH_ID=<uuid-of-an-unlocked-fargo-5v5-match>
```

Where to get one:

1. Sign up your test user at `/register` (locally) and run
   `database/dev_bootstrap_full.sql` to seed an org, league, season,
   teams, and matches. Make sure to add your test user to a team's
   roster as a captain first (the bootstrap does NOT do this for you).
2. The bootstrap RAISE NOTICEs at the end include a `teams: <UUIDs>`
   line. Pick any team, then look up a match for that team via Studio:
   ```sql
   SELECT id, scheduled_venue_id FROM matches
   WHERE home_team_id = '<team-id>' OR away_team_id = '<team-id>'
   ORDER BY id LIMIT 1;
   ```
3. Drop that match UUID into `E2E_TEST_MATCH_ID`.

If the env var is missing, the test is skipped with a clear message.

### Two-captain handoff is a follow-up

The full DD handoff (opposing captain receives the
`OpponentSubstituteModal`, picks the player, both captains auto-navigate
to scoring) needs a second test user account and two `BrowserContext`s
in the same test. Not in this spec — covered separately when the second
test account is set up. See `lineup-demo.spec.ts`'s file header for a
note pointing here.
