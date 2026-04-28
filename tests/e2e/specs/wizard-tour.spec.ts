/**
 * @fileoverview Reference example: LO wizard-tour (longer flow).
 *
 * Demonstrates the longer end-to-end pattern future "tour" tests should
 * copy. Doubles as the demo-recording target for sales reels and in-app
 * tutorials when run via `pnpm test:e2e:demo --grep wizard-tour`.
 *
 * Demonstrates:
 *   - Declaring an LO storage state (operator-only routes work).
 *   - Navigating across the LO's main surfaces (dashboard → operator
 *     dashboard → league-creation wizard entry).
 *   - Using exported foundation IDs (E2E_ORG_ID) instead of hardcoding.
 *
 * To record a sales reel:
 *
 *   pnpm e2e:setup                 # rebuild a clean foundation
 *   pnpm test:e2e:demo --grep wizard-tour   # headed + slowMo + video
 *
 * The video lands under test-results/<spec>/video.webm. Review it
 * locally before any external sharing — videos may capture session
 * details visible to the browser (URL, network tab if open).
 *
 * NOTE: this spec navigates to three operator routes and asserts each
 * rendered. The actual league-creation wizard is multi-step; once the
 * stable selectors for each stage are known, this spec should be
 * extended to drive them so the recorded video shows real wizard
 * interaction. For now the tour is navigational — enough to demonstrate
 * the pattern and the demo-mode pacing.
 */

import { test, expect } from '@playwright/test';
import { getStorageState, E2E_ORG_ID } from '../fixtures/users';

test.use({ storageState: getStorageState('lo') });

test.describe('Reference: wizard-tour (LO end-to-end)', () => {
  test('LO tours dashboard → operator dashboard → league wizard entry', async ({ page }) => {
    // Stage 1: LO lands on the player-style dashboard after login.
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Welcome,/i })).toBeVisible();

    // Stage 2: navigate to the operator dashboard for the foundation org.
    // E2E_ORG_ID is the deterministic UUID of E2E Test Org seeded by
    // database/e2e_seed.sql; the LO is owner-staff via the seed.
    await page.goto(`/operator-dashboard/${E2E_ORG_ID}`);
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Stage 3: open the league-creation wizard entry. Real feature tests
    // would drive each of Wizard 2.0's five stages here. For the
    // reference template, we just confirm the wizard entry renders.
    await page.goto(`/create-league/${E2E_ORG_ID}`);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});
