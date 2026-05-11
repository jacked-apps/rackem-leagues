/**
 * @fileoverview Playwright configuration for end-to-end browser tests.
 *
 * v1 SCAFFOLDING NOTE: this config supports the foundation-seed pattern
 * introduced in Units 1-4. Single-user PR #78 wiring (project-level
 * storageState pointing at user.json) has been removed; specs declare
 * their own starting user via `test.use({ storageState: getStorageState
 * (<key>) })` from `tests/e2e/fixtures/users.ts`.
 *
 * Run modes
 *
 *   pnpm test:e2e            Default — headless, parallel, against
 *                            http://localhost:5173 with auto-started Vite.
 *   pnpm test:e2e:demo       Demo recording — headed + slowMo:500 so the
 *                            recorded video is human-watchable. Filter to
 *                            tour tests with --grep when capturing.
 *   pnpm test:e2e:headed     Default suite, headed (debugging aid).
 *   pnpm test:e2e:ui         Playwright's interactive UI.
 *   pnpm test:e2e:report     Open the HTML report from the last run.
 *
 * Safety guard
 *
 *   This config refuses to load if E2E_BASE_URL points at a non-localhost
 *   target, unless E2E_REMOTE_OK=true is also set. The intent is to catch
 *   the "I forgot the env var and now I'm running mutating tests against
 *   staging or production" failure mode. v1 is local-only; v2 staging
 *   plan will define the right pattern for remote runs.
 *
 * Credentials
 *
 *   Live in .env.local (gitignored). See .env.example for the full list:
 *     E2E_PW         — foundation-user shared password
 *     E2E_LOCAL_OK   — gates the seed runner (NOT this config)
 *     E2E_DEMO       — set by `pnpm test:e2e:demo`
 *     E2E_REMOTE_OK  — escape hatch for non-localhost runs (rare)
 *
 * Video
 *
 *   Captured for every run. Regression-mode video is debugging aid; demo-
 *   mode video is the raw artifact for sales reels / in-app tutorials.
 *   See tests/e2e/README.md for the demo workflow.
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load .env.local (gitignored). Falls back to existing process.env.
dotenv.config({ path: '.env.local', quiet: true });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const isDemo = process.env.E2E_DEMO === '1' || process.env.E2E_DEMO === 'true';

// Safety guard: refuse to run mutating tests against a non-localhost target
// unless explicitly opted in. Catches the "stray E2E_BASE_URL set in shell"
// vector that would otherwise drive the suite at staging or production.
const isLocalhost =
  BASE_URL.includes('localhost') ||
  BASE_URL.includes('127.0.0.1') ||
  BASE_URL.includes('0.0.0.0');

if (!isLocalhost && process.env.E2E_REMOTE_OK !== 'true') {
  throw new Error(
    `E2E_BASE_URL points at a non-localhost target (${BASE_URL}). ` +
      'This v1 suite is local-only — running it elsewhere can mutate real data. ' +
      'If you genuinely need to run against a remote target, set E2E_REMOTE_OK=true. ' +
      'NEVER set this against production.'
  );
}

const isLocal = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'on',
    screenshot: 'only-on-failure',
    // Demo mode: visible browser + slow motion so the recorded video is
    // watchable. Regression mode (default): headless, full speed.
    headless: !isDemo,
    launchOptions: { slowMo: isDemo ? 500 : 0 },
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      // Specs declare their own starting user via test.use({ storageState }).
      // No project-level storageState — that pattern was the PR #78 single-
      // user model, replaced in Unit 3 by the foundation palette.
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },
  ],

  // Start the Vite dev server automatically for local runs. For any
  // remote target (escape-hatched via E2E_REMOTE_OK above), the app is
  // already deployed so no web server is started.
  webServer: isLocal
    ? {
        command: 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,
});
