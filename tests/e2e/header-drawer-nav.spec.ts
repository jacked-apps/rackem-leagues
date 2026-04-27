/**
 * @fileoverview E2E smoke for the global header's hamburger drawer.
 *
 * Verifies the cross-cutting nav flow that's the centerpiece of the
 * header rework: from any logged-in page, tapping the hamburger opens
 * the drawer with the player root items, tapping a drawer item closes
 * the drawer and navigates the user there.
 *
 * Relies on tests/e2e/.auth/user.json produced by auth.setup.ts — the
 * `chromium` project in playwright.config.ts wires that state in
 * automatically via `storageState`.
 */

import { test, expect } from '@playwright/test';

test.describe('Header drawer navigation (authenticated player)', () => {
  test('hamburger opens drawer with player items, navigation closes it', async ({ page }) => {
    await page.goto('/dashboard');

    // Hamburger lives in the global sticky header, accessible name "Open menu".
    await page.getByRole('button', { name: /open menu/i }).click();

    // Drawer is a Radix Dialog (role=dialog). Scope assertions to it so we
    // don't accidentally match the player Dashboard's own duplicated card
    // headings (e.g., "My Teams") elsewhere on the page.
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    await expect(drawer.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'My Teams' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Stats' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /^Messages/ })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: /sign out/i })).toBeVisible();

    // Tap My Teams — drawer should close and route should change to /my-teams.
    await drawer.getByRole('link', { name: 'My Teams' }).click();

    await expect(page).toHaveURL(/\/my-teams$/);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
