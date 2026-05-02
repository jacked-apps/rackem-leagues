/**
 * @fileoverview E2E tests for the team-drop / replace operator workflow
 * (PR 2 of the team-deletion-cascade fix).
 *
 * Walks through the user-visible behavior the brainstorm and plan call
 * out as the core of the new flow:
 *
 *   1. "Remove team from season" dialog appears for a team with matches
 *      (NOT a refusal toast). Confirming triggers drop_team RPC and the
 *      team disappears from the active list while a BYE shows up in
 *      Inactive Slots.
 *
 *   2. "Delete Team" still works for a team with zero matches.
 *
 *   3. Replacing a BYE that has past forfeits prompts the operator to
 *      allow makeups OR keep the forfeits.
 *
 * These are demonstration tests — they verify the dialogs render with
 * the expected copy and the underlying state changes happen via the
 * RPCs. They run against the local Supabase + Vite dev server seeded
 * by `pnpm e2e:setup` (see tests/e2e/README.md).
 */

import { test, expect } from '@playwright/test';
import { getStorageState } from '../fixtures/users';
import {
  createLeague,
  createSeason,
  createTeam,
  createMatch,
  markMatchCompleted,
  backdateSeasonWeek,
} from '../fixtures/factories';
import { getServiceClient } from '../fixtures/serviceClient';

test.use({ storageState: getStorageState('lo') });

test.describe('Team drop / replace workflow', () => {
  test('removing a team with matches shows the "Remove from Season" dialog and creates a BYE', async ({
    page,
  }) => {
    // Set up: league + season + 2 active teams + 1 played match between them.
    const league = await createLeague();
    const season = await createSeason(league.id, { weeks: 6 });
    const teamA = await createTeam(league.id, season.id, 'captain-1', {
      name: 'Drop-Test-Team-A',
    });
    const teamB = await createTeam(league.id, season.id, 'captain-2', {
      name: 'Drop-Test-Team-B',
    });

    // Played match in week 1 — gives teamA a real result so the dialog
    // copy hits the "has played matches" path.
    const playedMatch = await createMatch(season.id, season.weeks[0].id, teamA.id, teamB.id, {
      matchNumber: 1,
    });
    await markMatchCompleted(playedMatch.id, teamA.id);

    // Future scheduled match in week 3 — drop should reassign this to
    // the new BYE row.
    await createMatch(season.id, season.weeks[2].id, teamA.id, teamB.id, {
      matchNumber: 1,
    });

    await page.goto(`/league/${league.id}/manage-teams`);
    await expect(page.getByRole('heading', { name: /Manage Teams/i })).toBeVisible();
    await expect(page.getByText('Drop-Test-Team-A')).toBeVisible();

    // Click the destructive action on Team A. The aria-label encodes the
    // team name so we can target this specific card.
    await page.getByRole('button', { name: /Remove Drop-Test-Team-A from season/i }).click();

    // The dialog should be the "Remove from Season" variant — NOT a
    // toast refusal. Body copy matches the brainstorm's explanation.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('heading', { name: /Remove team from season/i })).toBeVisible();
    await expect(dialog).toContainText(/keep all of this team's played games recorded/i);
    await expect(dialog).toContainText(/Hide this team from active standings/i);
    await expect(dialog).toContainText(/Replace this team's remaining matches with a BYE/i);

    // Confirm the drop.
    await dialog.getByRole('button', { name: /Remove from Season/i }).click();

    // Active list no longer shows Team A.
    await expect(page.getByText('Drop-Test-Team-A')).toHaveCount(0, { timeout: 8000 });

    // Verify the post-drop DB state directly: team A is withdrawn and a
    // bye row was created.
    const supabase = getServiceClient();
    const { data: droppedTeam } = await supabase
      .from('teams')
      .select('status, withdrawn_at')
      .eq('id', teamA.id)
      .single();
    expect(droppedTeam?.status).toBe('withdrawn');
    expect(droppedTeam?.withdrawn_at).not.toBeNull();

    const { data: byeRows } = await supabase
      .from('teams')
      .select('id, team_name, status')
      .eq('season_id', season.id)
      .eq('status', 'bye');
    expect(byeRows?.length).toBe(1);
    expect(byeRows?.[0].team_name).toMatch(/^BYE — replaced Drop-Test-Team-A/);
  });

  test('deleting a team with no matches uses the "Delete Team" dialog and removes the row', async ({
    page,
  }) => {
    const league = await createLeague();
    const season = await createSeason(league.id, { weeks: 4 });
    const lonelyTeam = await createTeam(league.id, season.id, 'captain-3', {
      name: 'Lonely-Test-Team',
    });

    await page.goto(`/league/${league.id}/manage-teams`);
    await expect(page.getByText('Lonely-Test-Team')).toBeVisible();

    await page.getByRole('button', { name: /Remove Lonely-Test-Team from season/i }).click();

    // Zero-match path: dialog is the simpler "Delete Team" variant.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('heading', { name: /Delete Team/i })).toBeVisible();
    await expect(dialog).toContainText(/no matches yet/i);

    await dialog.getByRole('button', { name: /Delete Team/i }).click();

    // Team disappears + DB row is gone.
    await expect(page.getByText('Lonely-Test-Team')).toHaveCount(0, { timeout: 8000 });

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .eq('id', lonelyTeam.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  test('replacing a BYE that has past forfeits prompts to allow makeups', async ({ page }) => {
    const league = await createLeague();
    const season = await createSeason(league.id, { weeks: 4 });
    const droppingTeam = await createTeam(league.id, season.id, 'captain-1', {
      name: 'Forfeit-Drop-Team',
    });
    const opponent = await createTeam(league.id, season.id, 'captain-2', {
      name: 'Opponent-Team',
    });

    // Backdate week 1 so the match is "past-due" by the time the drop
    // runs. forfeit_past_bye_matches will then convert it to a forfeit
    // win for the opponent (status='completed', winner=opponent).
    await backdateSeasonWeek(season.weeks[0].id, /* daysAgo */ 7);
    await createMatch(season.id, season.weeks[0].id, droppingTeam.id, opponent.id, {
      matchNumber: 1,
    });

    await page.goto(`/league/${league.id}/manage-teams`);

    // Drop the team — drop_team's RPC will (a) reassign the past-week
    // match to the new BYE row and (b) immediately mark it
    // status='completed' with the opponent as winner via
    // forfeit_past_bye_matches with team filter.
    await page.getByRole('button', { name: /Remove Forfeit-Drop-Team from season/i }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /Remove from Season/i })
      .click();
    await expect(page.getByText('Forfeit-Drop-Team')).toHaveCount(0, { timeout: 8000 });

    // Confirm the past forfeit landed on the BYE row before driving
    // Replace UI.
    const supabase = getServiceClient();
    const { data: byeRow } = await supabase
      .from('teams')
      .select('id')
      .eq('season_id', season.id)
      .eq('status', 'bye')
      .single();
    expect(byeRow?.id).toBeTruthy();

    const { data: forfeitMatches } = await supabase
      .from('matches')
      .select('id, status, winner_team_id')
      .or(`home_team_id.eq.${byeRow!.id},away_team_id.eq.${byeRow!.id}`)
      .eq('status', 'completed');
    expect(forfeitMatches?.length).toBe(1);
    expect(forfeitMatches?.[0].winner_team_id).toBe(opponent.id);

    // Open Inactive Slots and click Replace on the BYE. There's only
    // one bye in this season so the first Replace button on the page
    // (after expanding the section) is the right one.
    await page.getByRole('button', { name: /Inactive Slots/i }).click();
    await page.getByRole('button', { name: /^Replace$/i }).first().click();

    // The makeup-prompt dialog appears because the BYE has 1 past forfeit.
    const dialog = page.getByRole('alertdialog');
    await expect(
      dialog.getByRole('heading', { name: /past forfeit match/i })
    ).toBeVisible();
    await expect(dialog).toContainText(/opposing team currently has a forfeit win/i);
    await expect(dialog.getByRole('button', { name: /Allow makeups/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Keep as forfeits/i })).toBeVisible();

    // Choosing "Allow makeups" closes the dialog and opens the team
    // editor in replace mode. We don't drive the modal to completion in
    // this spec — the convertMatchToMakeup loop happens after a real
    // submit, which would require driving the full team-create form
    // (covered by other specs). The pre-flight prompt is the part this
    // PR adds; verifying it surfaces is enough.
    await dialog.getByRole('button', { name: /Allow makeups/i }).click();

    // Modal should now be the team editor — its presence confirms the
    // flow advanced past the makeup prompt. The modal title is
    // "Add New Team" (not isEditing path) since this is a brand-new
    // team being created in replace mode.
    await expect(
      page.getByRole('heading', { name: /Add New Team/i })
    ).toBeVisible({ timeout: 5000 });
  });
});
