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
