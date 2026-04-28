/**
 * @fileoverview Reference example: single-captain lineup flow.
 *
 * The canonical "captain logs in, navigates to a feature page, asserts
 * the page rendered" pattern that future feature tests should copy.
 *
 * Demonstrates:
 *   - Declaring a starting user via getStorageState (auth comes for free
 *     from the setup project).
 *   - Composing a complete league/season/teams/match chain in one line
 *     via createMatchReadyForLineup.
 *   - Navigating to a route that requires team-membership authorization
 *     (the captain is wired in by the factory).
 *
 * This spec is intentionally minimal — it proves the pattern works.
 * Real feature tests for the lineup form (filling slots, locking,
 * unlocking, double-duty handoff) will copy this shape and add the
 * specific UI assertions for whatever feature they cover.
 */

import { test, expect } from '@playwright/test';
import { getStorageState } from '../fixtures/users';
import { createMatchReadyForLineup } from '../fixtures/factories';

test.use({ storageState: getStorageState('captain-1') });

test.describe('Reference: lineup-flow (single captain)', () => {
  test('captain reaches the lineup page for a match they are home captain of', async ({ page }) => {
    // Composite factory: spins up a complete league + season + 2 teams +
    // 1 match in milliseconds. Both match_lineups rows are auto-created
    // by trigger_auto_create_match_lineups (locked=false, no slots).
    const { match } = await createMatchReadyForLineup({
      homeCaptain: 'captain-1',
      awayCaptain: 'captain-2',
    });

    await page.goto(`/match/${match.id}/lineup`);

    // The page rendered. Any visible heading proves we cleared the
    // route-guard chain (auth + approved-member + match-membership)
    // and the MatchLineup component mounted. Feature tests would add
    // specific assertions for whatever they're testing.
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});
