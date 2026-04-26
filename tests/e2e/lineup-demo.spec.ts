/**
 * @fileoverview Lineup-flow demo spec — single captain.
 *
 * Drives one captain through the lineup-entry flow on a Fargo 5v5 match:
 *   - lands on the lineup page via deep link
 *   - picks 4 real players + a Double Duty placeholder
 *   - verifies the new pre-lock blue info banner ("After you lock your
 *     lineup, a request will be sent to {opponent}…") shows up
 *   - enters Fargo manual ratings for the 4 real players
 *   - confirms the Lock button becomes enabled once the lineup is
 *     complete enough
 *
 * Doubles as a sales/demo asset — Playwright records video to
 * `test-results/<test-name>/video.webm` for every run, so a successful
 * pass produces a polished walkthrough you can hand to a sponsor.
 *
 * The two-captain handoff (opposing captain receiving the
 * OpponentSubstituteModal, picking the DD player, both navigating to
 * scoring) is a follow-up — that requires a second authenticated test
 * user and two BrowserContexts. See tests/e2e/README.md for setup.
 *
 * Prerequisites in env (typically .env.local):
 *   - E2E_TEST_EMAIL / E2E_TEST_PASSWORD — auth.setup.ts uses these.
 *   - E2E_TEST_MATCH_ID — UUID of an unlocked Fargo 5v5 match where the
 *     test user is on one of the rosters as a captain. Easiest source:
 *     the dev_bootstrap_full.sql output (see RAISE NOTICE 'teams:').
 */

import { test, expect } from '@playwright/test';

// Slight pause between actions so the recorded video is watchable rather
// than a blur of clicks. ~600ms feels natural for a demo reel without
// dragging.
const DEMO_BEAT_MS = 600;
const beat = (page: import('@playwright/test').Page) =>
  page.waitForTimeout(DEMO_BEAT_MS);

test.describe('Lineup entry — single captain demo', () => {
  test.skip(
    !process.env.E2E_TEST_MATCH_ID,
    'E2E_TEST_MATCH_ID env var required (UUID of an unlocked Fargo 5v5 match — see dev_bootstrap_full.sql output).'
  );

  test('captain fills lineup and sees Lock become available', async ({ page }) => {
    const matchId = process.env.E2E_TEST_MATCH_ID!;

    await test.step('open the lineup page for this match', async () => {
      await page.goto(`/match/${matchId}/lineup`);
      await expect(
        page.getByRole('heading', { name: /Lineup Entry/i })
      ).toBeVisible({ timeout: 10_000 });
      await beat(page);
    });

    await test.step('pick 4 real players for slots 1–4', async () => {
      // The PlayerSelectionRow uses a shadcn Select. Each row's trigger
      // shows "Select Player N" until something is picked. We open each
      // trigger in turn and pick the first non-sub option.
      for (let pos = 1; pos <= 4; pos++) {
        const trigger = page.getByRole('combobox', {
          name: new RegExp(`Select Player ${pos}`, 'i'),
        });
        // Fall back to the trigger's placeholder text if accessible-name
        // resolution doesn't match.
        const triggerOrFallback = (await trigger.count())
          ? trigger.first()
          : page.getByText(`Select Player ${pos}`).first();

        await triggerOrFallback.click();
        // Pick the first menu item that isn't one of the sub options.
        const firstRoster = page
          .getByRole('option')
          .filter({
            hasNotText: /Anonymous Sub|Double Duty/,
          })
          .first();
        await firstRoster.click();
        await beat(page);
      }
    });

    await test.step('pick Double Duty for slot 5', async () => {
      const trigger = page.getByRole('combobox', {
        name: /Select Player 5/i,
      });
      const triggerOrFallback = (await trigger.count())
        ? trigger.first()
        : page.getByText('Select Player 5').first();
      await triggerOrFallback.click();

      await page
        .getByRole('option', { name: /Double Duty/i })
        .first()
        .click();
      await beat(page);
    });

    await test.step('pre-lock blue banner appears explaining the upcoming flow', async () => {
      // PrepStatusBanner pre-lock copy starts with "After you lock your
      // lineup, a request will be sent to…"
      await expect(
        page.getByText(
          /After you lock your lineup, a request will be sent to/i
        )
      ).toBeVisible({ timeout: 5_000 });
      await beat(page);
    });

    await test.step('enter Fargo ratings for slots 1–4', async () => {
      // HandicapCell renders an <Input type="number"> for Fargo. There's
      // no per-slot accessible label on the input today, so we grab them
      // by position via the row order. (TODO: add aria-labels in a
      // follow-up so this can be a getByRole query.)
      const ratingInputs = page.locator('input[type="number"]');
      const ratings = ['525', '480', '450', '400'];
      const count = await ratingInputs.count();
      const usable = Math.min(count, ratings.length);
      for (let i = 0; i < usable; i++) {
        const input = ratingInputs.nth(i);
        await input.click();
        await input.fill(ratings[i]);
        await beat(page);
      }
    });

    await test.step('Lock Lineup button becomes enabled', async () => {
      const lockBtn = page.getByRole('button', { name: /Lock Lineup/i });
      await expect(lockBtn).toBeVisible();
      // The button is disabled until completeness + Fargo validation pass.
      await expect(lockBtn).toBeEnabled({ timeout: 5_000 });
      await beat(page);
    });

    // Intentionally do NOT click Lock — keeping the test idempotent so
    // it doesn't lock the demo match across runs. The screenshot/video
    // captures the captain ready to commit.
  });
});
