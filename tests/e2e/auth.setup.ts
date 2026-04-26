/**
 * @fileoverview Playwright auth setup — runs once before the test suite,
 * drives the login UI with credentials from .env.local, and saves the
 * resulting authenticated session state so subsequent tests start signed
 * in without each having to log in themselves.
 *
 * Credentials source (in order of precedence):
 *   1. E2E_TEST_EMAIL / E2E_TEST_PASSWORD in process env
 *   2. Same variables loaded from .env.local by playwright.config.ts
 *
 * Output:
 *   tests/e2e/.auth/user.json — consumed by the `chromium` project via
 *   `storageState` (see playwright.config.ts).
 */

import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'tests/e2e/.auth/user.json';

setup('authenticate via login UI', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set (put them in .env.local). ' +
        'See tests/e2e/README.md for setup instructions.'
    );
  }

  // Navigate to the login page and drive the form exactly as a user would.
  // We use UI-driven login (not a programmatic Supabase call) so this step
  // also smoke-tests that the login flow itself works.
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();

  // Successful login redirects to /dashboard. If credentials are wrong
  // the page stays on /login with an error message — this timeout will
  // fire and surface the failure clearly.
  await page.waitForURL('/dashboard', { timeout: 15_000 });

  // Quick sanity check: the welcome heading renders with the user's name.
  await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();

  // Persist cookies + localStorage (where Supabase stores its session)
  // so the main test project can reuse this authenticated state.
  await page.context().storageState({ path: AUTH_FILE });
});
