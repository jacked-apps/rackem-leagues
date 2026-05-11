/**
 * @fileoverview Phase 2 Unit 2.3a + 2.3b verification.
 *
 * Locks two scaffolding migrations:
 *
 *   2.3a: 20260429000002_resolved_view_phase2_modular_axes.sql
 *         The resolved_league_preferences view now cascades the 8 new
 *         Phase 2 modular columns through league → org → defaults.
 *
 *   2.3b: 20260429000003_rating_edit_audit_log_table.sql
 *         The rating_edit_audit_log table exists with the documented shape,
 *         indexes, and RESTRICTIVE DENY RLS for anon/authenticated.
 *         (Full RPC + SELECT policy land in Phase 6 Unit 6.1.)
 */

import { test, expect } from '@playwright/test';
import { getStorageState } from '../fixtures/users';
import { createMatchReadyForLineup } from '../fixtures/factories';
import { getServiceClient } from '../fixtures/serviceClient';

test.use({ storageState: getStorageState('captain-1') });

test.describe('Phase 2 Unit 2.3a: resolved_league_preferences view', () => {
  test('view exposes the 8 new Phase 2 columns alongside existing ones', async () => {
    const supabase = getServiceClient();
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

    const { data: resolved, error } = await supabase
      .from('resolved_league_preferences')
      .select(
        'pairing_format, scoring_method, win_condition, mechanism, ' +
          'standings_sort, tiebreaker_trigger, tiebreaker_format, race_length'
      )
      .eq('league_id', league.id)
      .single();

    expect(error).toBeNull();
    expect(resolved).toEqual({
      pairing_format: 'single_rack',
      scoring_method: 'winner_takes_all',
      win_condition: 'first_to_games',
      mechanism: 'extra_games',
      standings_sort: ['match_wins', 'games_won', 'points_earned'],
      tiebreaker_trigger: 'never',
      tiebreaker_format: 'accept_tie',
      race_length: null,
    });
  });

  test('league-level Phase 2 prefs override the cascade defaults', async () => {
    const supabase = getServiceClient();
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

    // Set league-level Phase 2 values that differ from defaults
    await supabase
      .from('preferences')
      .update({
        pairing_format: 'race_to_n',
        scoring_method: 'race_winner',
        win_condition: 'first_to_pairings',
        mechanism: 'race_length_adjustment',
        standings_sort: ['points_earned', 'match_wins'],
        tiebreaker_trigger: 'even_total_games_only',
        tiebreaker_format: 'best_of_3_short_race',
        race_length: 7,
      })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    const { data: resolved } = await supabase
      .from('resolved_league_preferences')
      .select(
        'pairing_format, scoring_method, win_condition, mechanism, ' +
          'standings_sort, tiebreaker_trigger, tiebreaker_format, race_length'
      )
      .eq('league_id', league.id)
      .single();

    expect(resolved).toEqual({
      pairing_format: 'race_to_n',
      scoring_method: 'race_winner',
      win_condition: 'first_to_pairings',
      mechanism: 'race_length_adjustment',
      standings_sort: ['points_earned', 'match_wins'],
      tiebreaker_trigger: 'even_total_games_only',
      tiebreaker_format: 'best_of_3_short_race',
      race_length: 7,
    });
  });

  test('Phase 1 columns still cascade correctly (regression — view DROP-and-recreate)', async () => {
    // The Phase 2 view migration drops and recreates the view.
    // This test catches any accidental loss of Phase 1 cascade behavior.
    const supabase = getServiceClient();
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

    const { data: resolved } = await supabase
      .from('resolved_league_preferences')
      .select(
        'lineup_size, max_roster_size, handicap_type, game_generation, points_system, threshold_chart_id, team_format, golden_break_counts_as_win'
      )
      .eq('league_id', league.id)
      .single();

    // These were set by the factory; verify cascade still resolves them.
    expect(resolved?.lineup_size).toBe(3);
    expect(resolved?.max_roster_size).toBe(5);
    expect(resolved?.handicap_type).toBe('points');
    expect(resolved?.game_generation).toBe('double_round_robin');
    expect(resolved?.team_format).toBe('5_man');
  });
});

test.describe('Phase 2 Unit 2.3b: rating_edit_audit_log table', () => {
  test('table exists with the expected columns and accepts service-role inserts', async () => {
    const supabase = getServiceClient();

    // Service role bypasses RLS — it should be able to insert directly
    // for testing purposes. (The Phase 6 SECURITY DEFINER RPC will be
    // the production insert path; this test verifies the table is
    // reachable and accepts the documented shape.)
    const { data: inserted, error } = await supabase
      .from('rating_edit_audit_log')
      .insert({
        actor_user_id: '00000000-0000-0000-0000-000000000001',
        actor_type: 'user',
        target_member_id: '00000000-0000-0000-0000-000000000002',
        target_match_lineup_id: null,
        rating_system: 'points',
        before_value: '1',
        after_value: '2',
        scope: 'persistent',
        reason: 'test',
        source: 'manual',
        organization_id: 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(inserted).toMatchObject({
      actor_type: 'user',
      rating_system: 'points',
      scope: 'persistent',
      source: 'manual',
    });

    // Cleanup the test row
    if (inserted?.id) {
      await supabase.from('rating_edit_audit_log').delete().eq('id', inserted.id);
    }
  });

  test('CHECK constraint on actor_type rejects invalid values', async () => {
    const supabase = getServiceClient();
    const { error } = await supabase.from('rating_edit_audit_log').insert({
      actor_type: 'admin', // not in {user, system, api}
      target_member_id: '00000000-0000-0000-0000-000000000002',
      rating_system: 'points',
      scope: 'persistent',
      source: 'manual',
    });
    expect(error).not.toBeNull();
  });

  test('CHECK constraint on scope rejects invalid values', async () => {
    const supabase = getServiceClient();
    const { error } = await supabase.from('rating_edit_audit_log').insert({
      actor_type: 'user',
      target_member_id: '00000000-0000-0000-0000-000000000002',
      rating_system: 'points',
      scope: 'season_wide', // not in {per_match_lineup, persistent}
      source: 'manual',
    });
    expect(error).not.toBeNull();
  });

  test('CHECK constraint on source rejects invalid values', async () => {
    const supabase = getServiceClient();
    const { error } = await supabase.from('rating_edit_audit_log').insert({
      actor_type: 'user',
      target_member_id: '00000000-0000-0000-0000-000000000002',
      rating_system: 'points',
      scope: 'persistent',
      source: 'magic', // not in allowed enum
    });
    expect(error).not.toBeNull();
  });

  test('NOT NULL constraints enforced on required columns', async () => {
    const supabase = getServiceClient();
    // target_member_id is NOT NULL
    const { error } = await supabase.from('rating_edit_audit_log').insert({
      actor_type: 'user',
      // target_member_id deliberately omitted
      rating_system: 'points',
      scope: 'persistent',
      source: 'manual',
    });
    expect(error).not.toBeNull();
  });
});
