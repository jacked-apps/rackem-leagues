/**
 * @fileoverview Smoke test that the player dashboard renders for an
 * authenticated foundation user. Primarily exists to prove the Playwright
 * + foundation-seed scaffolding (Units 1-4) works end to end. More specific
 * feature tests live in sibling files under tests/e2e/specs/.
 *
 * Starting user: e2e-captain-1 (Captain). Picked because the dashboard's
 * default render is the most representative for the captain-side flows
 * future specs will exercise.
 */

import { test, expect } from '@playwright/test';
import { getStorageState } from './fixtures/users';

test.use({ storageState: getStorageState('captain-1') });

test.describe('Dashboard (authenticated as e2e-captain-1)', () => {
  test('renders welcome, quick actions, and share card', async ({ page }) => {
    await page.goto('/dashboard');

    // Welcome heading — format is "Welcome, <first name>!" The seed gives
    // captain-1 first_name='E2E', so the heading reads "Welcome, E2E!".
    await expect(page.getByRole('heading', { name: /Welcome,/i })).toBeVisible();

    // Quick action cards — render for any authenticated player.
    await expect(page.getByRole('heading', { name: 'My Teams' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Player Settings' })).toBeVisible();

    // Share card.
    await expect(page.getByRole('heading', { name: /Invite teammates/i })).toBeVisible();
  });
});
