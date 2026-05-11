/**
 * @fileoverview Multi-user auth setup for the E2E suite.
 *
 * Runs once before every test run (Playwright "setup" project, see
 * playwright.config.ts). For each foundation user defined in
 * fixtures/users.ts, drives the login UI and saves the resulting
 * authenticated session to tests/e2e/.auth/<key>.json. Specs then
 * declare their starting user via:
 *
 *   import { getStorageState } from './fixtures/users';
 *   test.use({ storageState: getStorageState('captain-1') });
 *
 * Why a single setup test (not five)
 *
 *   Playwright's setup-project dependency is at the project level, not
 *   the test level. If we split into five tests they would race the
 *   storage-state writes (each test runs in its own context but they
 *   may execute in parallel within the setup project, depending on
 *   fullyParallel). One test, serial loop, no races.
 *
 * Why UI login (not programmatic Supabase signInWithPassword)
 *
 *   page.evaluate(() => supabase.auth.signInWithPassword(...)) doesn't
 *   work — the Supabase client in this app is a module-scoped import,
 *   not on `window`. UI login per user is a one-time ~10–15s cost at
 *   suite startup that also smokes the login form as a side effect.
 *   If startup time becomes an issue later, switch to Node-side
 *   @supabase/supabase-js in this file (not page.evaluate).
 *
 * Replaces the single-user PR #78 setup. The legacy E2E_TEST_EMAIL /
 * E2E_TEST_PASSWORD env vars are no longer read here.
 */

import { test as setup } from '@playwright/test';
import { E2E_USERS, getStorageState, type UserKey } from './fixtures/users';

setup('authenticate all foundation users', async ({ browser }) => {
  for (const entry of Object.entries(E2E_USERS)) {
    const key = entry[0] as UserKey;
    const { email, password } = entry[1];

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Login' }).click();

      // Wait for navigation away from /login. We don't assert a specific
      // landing URL because different foundation users may legitimately
      // land different places (e.g., observer with no team affiliation
      // could redirect to /complete-profile in some app states; the
      // dashboard.spec.ts and feature specs assert per-route behavior
      // separately). The relevant signal here is "no longer on /login,"
      // which proves the credentials were accepted.
      await page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: 15_000,
      });

      await context.storageState({ path: getStorageState(key) });
    } catch (err) {
      throw new Error(
        `Auth setup failed for foundation user "${key}" (${email}): ` +
          `${(err as Error).message}\n\n` +
          `Common causes:\n` +
          `  - The foundation seed was not run. Try: pnpm e2e:setup\n` +
          `  - The bcrypt hash does not match E2E_PW. Try: pnpm e2e:verify-auth\n` +
          `  - Local Supabase is not running. Try: pnpm db:start\n`
      );
    } finally {
      await context.close();
    }
  }
});
