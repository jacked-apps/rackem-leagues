/**
 * @fileoverview E2E foundation user palette.
 *
 * The 5 users seeded by database/e2e_seed.sql. Each is pre-authenticated
 * once per test run by tests/e2e/auth.setup.ts. Specs declare which
 * foundation user they start as via getStorageState(<key>).
 *
 * Single-user spec
 *
 *   import { test } from '@playwright/test';
 *   import { getStorageState } from './fixtures/users';
 *
 *   test.use({ storageState: getStorageState('captain-1') });
 *
 *   test('captain does X', async ({ page }) => {
 *     await page.goto('/dashboard');
 *     // Already logged in as captain-1.
 *   });
 *
 * Multi-actor spec (different users in different browser contexts)
 *
 *   test('handoff flow', async ({ browser }) => {
 *     const homeContext = await browser.newContext({
 *       storageState: getStorageState('captain-1'),
 *     });
 *     const awayContext = await browser.newContext({
 *       storageState: getStorageState('captain-2'),
 *     });
 *     const homePage = await homeContext.newPage();
 *     const awayPage = await awayContext.newPage();
 *     // homePage and awayPage are logged in as different users.
 *   });
 *
 * Foundation users
 *
 *   lo           — League Operator. Use for wizard / LO-side tests.
 *   captain-1    — Captain (home team). Default for single-captain flows.
 *   captain-2    — Captain (away team). Default for opposing-side context.
 *   captain-3    — Reserve captain. Use when a third independent context
 *                  is needed (e.g., observer-as-captain scenarios).
 *   observer     — No team affiliation. Use for spectator route / live-
 *                  view tests where the user shouldn't be on a roster.
 *
 * E2E_PW lives in .env.local (gitignored). The bcrypt hash committed in
 * database/e2e_seed.sql was generated for that value. If E2E_PW is unset,
 * the auth setup will throw at startup with a clear message pointing here.
 */

const E2E_PW = process.env.E2E_PW;

if (!E2E_PW) {
  throw new Error(
    'E2E_PW is not set. Add it to .env.local (see .env.example for the value reference). ' +
      'The auth setup and verify scripts both depend on this env var matching the bcrypt ' +
      'hash committed in database/e2e_seed.sql. Run `pnpm e2e:setup` after setting it.'
  );
}

export const E2E_USERS = {
  'lo': { email: 'e2e-lo@test.test', password: E2E_PW },
  'captain-1': { email: 'e2e-captain-1@test.test', password: E2E_PW },
  'captain-2': { email: 'e2e-captain-2@test.test', password: E2E_PW },
  'captain-3': { email: 'e2e-captain-3@test.test', password: E2E_PW },
  'observer': { email: 'e2e-observer@test.test', password: E2E_PW },
} as const;

export type UserKey = keyof typeof E2E_USERS;

/**
 * Returns the storage-state file path for a foundation user. The file is
 * created by tests/e2e/auth.setup.ts on every test run.
 */
export function getStorageState(key: UserKey): string {
  return `tests/e2e/.auth/${key}.json`;
}
