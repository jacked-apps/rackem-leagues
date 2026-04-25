/**
 * @fileoverview Playwright configuration for end-to-end browser tests.
 *
 * Two run modes driven by environment variables:
 *   - Local (default):   base URL is http://localhost:5173 and Playwright
 *                         auto-starts `pnpm dev` before tests run.
 *   - Staging (or any):  set E2E_BASE_URL=https://staging.rackemleagues.com
 *                         (or any other URL). Playwright does NOT start a
 *                         dev server; it hits the remote URL directly.
 *
 * Test credentials live in .env.local (gitignored) as E2E_TEST_EMAIL and
 * E2E_TEST_PASSWORD. Create a dedicated test user on whichever environment
 * you are pointing at — do not use your real account.
 *
 * Tests are organized into two projects:
 *   1. `setup` — runs tests/e2e/auth.setup.ts first, drives the login UI
 *                once, and saves the authenticated session state to
 *                tests/e2e/.auth/user.json so the real tests don't each
 *                have to log in.
 *   2. `chromium` — all tests under tests/e2e except *.setup.ts, runs
 *                   with the saved storage state so they start signed in.
 *
 * Video is recorded for every run (not just failures) so demo reels can
 * be pulled straight from test-results/ without rerunning.
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load .env.local (gitignored) so credentials can be kept out of the repo.
// Falls back to regular env vars if .env.local isn't present.
dotenv.config({ path: '.env.local', quiet: true });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
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
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Start the Vite dev server automatically for local runs. For staging
  // or any remote target, the app is already deployed so no web server
  // is started.
  webServer: isLocal
    ? {
        command: 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,
});
