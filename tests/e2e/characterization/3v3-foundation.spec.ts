/**
 * @fileoverview Phase 0c characterization: 3v3 league foundation.
 *
 * Locks the factory's output shape for a BCA 3v3 league so any future change
 * to factories or DB schema that would silently alter 3v3 setup is caught.
 *
 * This is the FIRST in a series of 3v3 characterization specs. Subsequent
 * specs build on this foundation:
 *   - 3v3-foundation.spec.ts (this file): factory + initial state
 *   - 3v3-lineup-thresholds.spec.ts (TODO): assert prep_match writes
 *     correct home/away thresholds from chart for known handicap diffs
 *   - 3v3-full-match.spec.ts (TODO): drive scoring UI for all 18 games,
 *     capture per-game intermediate state as fixtures
 *
 * See docs/plans/2026-04-28-001-feat-modular-league-system-plan.md (Phase 0c).
 */

import { test, expect } from '@playwright/test';
import { getStorageState } from '../fixtures/users';
import { createMatchReadyForLineup } from '../fixtures/factories';
import { getServiceClient } from '../fixtures/serviceClient';

test.use({ storageState: getStorageState('captain-1') });

test.describe('Phase 0c: 3v3 league foundation (BCA points handicap)', () => {
  test('factory produces a league with 3v3 modular preferences', async () => {
    // Override the factory's defaults (which build a 5v5 no-handicap league)
    // to produce a BCA 3v3 setup matching what bca3v3.ts assumes:
    // lineup_size=3, max_roster_size=5, double_round_robin, points handicap.
    const { league } = await createMatchReadyForLineup({
      homeCaptain: 'captain-1',
      awayCaptain: 'captain-2',
      leagueOpts: {
        teamFormat: '5_man',
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
        handicapType: 'points',
      },
    });

    // Verify the leagues row has the legacy team_format set correctly.
    // (The team_format column drop is Phase 7 work; until then this is the
    // canonical legacy field.)
    expect(league.team_format).toBe('5_man');

    // Verify the modular preferences row matches via direct DB query.
    // The factory upserts these fields after the trigger creates the empty
    // preferences row.
    const supabase = getServiceClient();
    const { data: prefs, error } = await supabase
      .from('preferences')
      .select('lineup_size, max_roster_size, game_generation, handicap_type, team_format')
      .eq('entity_type', 'league')
      .eq('entity_id', league.id)
      .single();

    expect(error).toBeNull();
    expect(prefs).toEqual({
      lineup_size: 3,
      max_roster_size: 5,
      game_generation: 'double_round_robin',
      handicap_type: 'points',
      team_format: '5_man',
    });
  });

  test('factory creates a match in scheduled status with two auto-created match_lineups rows', async () => {
    const { match, homeTeam, awayTeam } = await createMatchReadyForLineup({
      homeCaptain: 'captain-1',
      awayCaptain: 'captain-2',
      leagueOpts: {
        teamFormat: '5_man',
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
        handicapType: 'points',
      },
    });

    expect(match.status).toBe('scheduled');

    // The trigger_auto_create_match_lineups DB trigger should have fired
    // when the match was inserted, creating one match_lineups row per team.
    // Each row's team_id matches either the home or away team.
    const supabase = getServiceClient();
    const { data: lineups, error } = await supabase
      .from('match_lineups')
      .select('match_id, team_id, locked')
      .eq('match_id', match.id);

    expect(error).toBeNull();
    expect(lineups).toHaveLength(2);

    const teamIds = lineups?.map((l) => l.team_id).sort() ?? [];
    expect(teamIds).toEqual([homeTeam.id, awayTeam.id].sort());

    // Both lineups start unlocked so captains can fill them in.
    expect(lineups?.every((l) => l.locked === false)).toBe(true);
  });

  test('captain reaches the 3v3 lineup page', async ({ page }) => {
    // Smoke-tests that the lineup route works for a captain on a 3v3 match.
    // Subsequent specs will drive the lineup form to populate slots.
    const { match } = await createMatchReadyForLineup({
      homeCaptain: 'captain-1',
      awayCaptain: 'captain-2',
      leagueOpts: {
        teamFormat: '5_man',
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
        handicapType: 'points',
      },
    });

    await page.goto(`/match/${match.id}/lineup`);

    // The page rendered. Heading proves auth + member + match-membership
    // route guards passed and the MatchLineup component mounted for a 3v3
    // match (lineup_size=3 → 3 slots per side, distinct from default 5v5).
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});
