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
  'lo': {
    email: 'e2e-lo@test.test',
    password: E2E_PW,
    userId: 'e0e0e0e0-aaaa-aaaa-aaaa-000000000001',
    memberId: 'e0e0e0e0-bbbb-bbbb-bbbb-000000000001',
  },
  'captain-1': {
    email: 'e2e-captain-1@test.test',
    password: E2E_PW,
    userId: 'e0e0e0e0-aaaa-aaaa-aaaa-000000000002',
    memberId: 'e0e0e0e0-bbbb-bbbb-bbbb-000000000002',
  },
  'captain-2': {
    email: 'e2e-captain-2@test.test',
    password: E2E_PW,
    userId: 'e0e0e0e0-aaaa-aaaa-aaaa-000000000003',
    memberId: 'e0e0e0e0-bbbb-bbbb-bbbb-000000000003',
  },
  'captain-3': {
    email: 'e2e-captain-3@test.test',
    password: E2E_PW,
    userId: 'e0e0e0e0-aaaa-aaaa-aaaa-000000000004',
    memberId: 'e0e0e0e0-bbbb-bbbb-bbbb-000000000004',
  },
  'observer': {
    email: 'e2e-observer@test.test',
    password: E2E_PW,
    userId: 'e0e0e0e0-aaaa-aaaa-aaaa-000000000005',
    memberId: 'e0e0e0e0-bbbb-bbbb-bbbb-000000000005',
  },
} as const;

export type UserKey = keyof typeof E2E_USERS;

/**
 * Foundation organization seeded by database/e2e_seed.sql. Factories
 * attach throwaway leagues to this org so the cleanup chain in the seed
 * can find and remove them by org_id.
 */
export const E2E_ORG_ID = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc';

/**
 * Foundation venue seeded by database/e2e_seed.sql. Factories use it as
 * the home_venue_id for throwaway teams (avoids creating a new venue
 * per test).
 */
export const E2E_VENUE_ID = 'e0e0e0e0-dddd-dddd-dddd-dddddddddddd';

/**
 * Returns the storage-state file path for a foundation user. The file is
 * created by tests/e2e/auth.setup.ts on every test run.
 */
export function getStorageState(key: UserKey): string {
  return `tests/e2e/.auth/${key}.json`;
}

/**
 * Returns the seeded `members.id` for a foundation user. Useful when a
 * factory needs to set captain_id on a teams row, since teams.captain_id
 * is a member_id (not user_id).
 */
export function getMemberId(key: UserKey): string {
  return E2E_USERS[key].memberId;
}
