/**
 * @fileoverview First real E2E test: verifies the player Dashboard renders
 * correctly for an authenticated user. This test exists primarily to prove
 * the Playwright + auth-fixture infrastructure works end to end. More
 * specific feature tests will live in sibling *.spec.ts files.
 *
 * Relies on tests/e2e/.auth/user.json produced by auth.setup.ts — the
 * `chromium` project in playwright.config.ts wires that state in
 * automatically via `storageState`.
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard (authenticated)', () => {
  test('renders welcome, quick actions, and share card', async ({ page }) => {
    await page.goto('/dashboard');

    // Welcome heading — format is "Welcome, <first name>!"
    await expect(page.getByRole('heading', { name: /Welcome,/i })).toBeVisible();

    // Quick action cards
    await expect(page.getByRole('heading', { name: 'My Teams' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Player Settings' })).toBeVisible();

    // Share card (added 2026-04-21)
    await expect(page.getByRole('heading', { name: /Invite teammates/i })).toBeVisible();
  });
});
