/**
 * @fileoverview Phase 2 Unit 2.1 verification: modular preference axes.
 *
 * Verifies the migration
 * `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql`:
 *
 *   1. New columns exist with correct defaults
 *   2. CHECK constraints reject invalid values
 *   3. Soft cap on max_roster_size (≤30) is enforced
 *   4. Existing handicap_type still accepts 'skill_level' (BCAPL SL ready)
 *   5. standings_sort accepts a subset of allowed keys
 *
 * The 8 new columns are tier-2/3 modular preferences — they're NOT covered
 * by the Phase 1 Unit 1.1 status-aware tier-1 lock and remain editable
 * post-first-match. (Phase 5 will add per-dial mid-season-safety
 * classification.)
 */

import { test, expect } from '@playwright/test';
import { getStorageState } from '../fixtures/users';
import { createMatchReadyForLineup } from '../fixtures/factories';
import { getServiceClient } from '../fixtures/serviceClient';

test.use({ storageState: getStorageState('captain-1') });

test.describe('Phase 2 Unit 2.1: modular preference axes', () => {
  test('new league preferences row has the 8 new columns at sensible defaults', async () => {
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

    const { data: prefs, error } = await supabase
      .from('preferences')
      .select(
        'pairing_format, scoring_method, win_condition, mechanism, ' +
          'standings_sort, tiebreaker_trigger, tiebreaker_format, race_length'
      )
      .eq('entity_type', 'league')
      .eq('entity_id', league.id)
      .single();

    expect(error).toBeNull();
    expect(prefs).toEqual({
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

  test('all 8 new columns accept their valid enum values via UPDATE', async () => {
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

    // BCAPL SL race-to-N example: change to a fully race-format combo
    const { error } = await supabase
      .from('preferences')
      .update({
        pairing_format: 'race_to_n',
        scoring_method: 'race_winner',
        win_condition: 'first_to_pairings',
        mechanism: 'race_length_adjustment',
        standings_sort: ['match_wins', 'points_earned'],
        tiebreaker_trigger: 'even_total_games_only',
        tiebreaker_format: 'best_of_3_short_race',
        race_length: 5,
      })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).toBeNull();
  });

  test('handicap_type accepts skill_level (BCAPL SL support)', async () => {
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

    // skill_level is the BCAPL SL system — was already in the constraint
    // from migration 20260410000000 but we re-verify it here.
    const { error } = await supabase
      .from('preferences')
      .update({ handicap_type: 'skill_level' })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).toBeNull();
  });

  test('CHECK constraints reject invalid enum values', async () => {
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

    const cases = [
      { col: 'pairing_format', value: 'invalid_format' },
      { col: 'scoring_method', value: 'made_up_scoring' },
      { col: 'win_condition', value: 'never' },
      { col: 'mechanism', value: 'invalid_mech' },
      { col: 'tiebreaker_trigger', value: 'always' },
      { col: 'tiebreaker_format', value: 'sudden_death' },
    ];

    for (const c of cases) {
      const { error } = await supabase
        .from('preferences')
        .update({ [c.col]: c.value })
        .eq('entity_type', 'league')
        .eq('entity_id', league.id);

      expect(error, `column ${c.col} should reject "${c.value}"`).not.toBeNull();
    }
  });

  test('standings_sort rejects values outside the allowed key set', async () => {
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

    // 'head_to_head' is deferred — not in the allowed set today (R10 explicitly defers it)
    const { error } = await supabase
      .from('preferences')
      .update({ standings_sort: ['match_wins', 'head_to_head'] })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).not.toBeNull();
  });

  test('standings_sort accepts a SUBSET of allowed keys (e.g. just one)', async () => {
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

    const { error } = await supabase
      .from('preferences')
      .update({ standings_sort: ['points_earned'] })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).toBeNull();
  });

  test('max_roster_size soft cap rejects values >20 (pre-existing constraint)', async () => {
    // The cap is enforced by preferences_max_roster_size_check from
    // 20260410000000_extend_preferences_modular (1..20). Phase 2 doesn't
    // add a duplicate; this test locks the existing cap behavior.
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

    const { error } = await supabase
      .from('preferences')
      .update({ max_roster_size: 50 })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).not.toBeNull();
  });

  test('max_roster_size accepts boundary values (1 and 20)', async () => {
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

    const { error: lowErr } = await supabase
      .from('preferences')
      .update({ max_roster_size: 1 })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);
    expect(lowErr).toBeNull();

    const { error: highErr } = await supabase
      .from('preferences')
      .update({ max_roster_size: 20 })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);
    expect(highErr).toBeNull();
  });

  test('race_length accepts integers >=1; rejects 0 and negatives', async () => {
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

    const { error: validErr } = await supabase
      .from('preferences')
      .update({ race_length: 7 })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);
    expect(validErr).toBeNull();

    const { error: zeroErr } = await supabase
      .from('preferences')
      .update({ race_length: 0 })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);
    expect(zeroErr).not.toBeNull();

    const { error: negErr } = await supabase
      .from('preferences')
      .update({ race_length: -1 })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);
    expect(negErr).not.toBeNull();
  });

  test('NULL is allowed for all new columns (means "use cascade default")', async () => {
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

    // All NULL is a valid state (preferences cascade falls through to org/system)
    const { error } = await supabase
      .from('preferences')
      .update({
        pairing_format: null,
        scoring_method: null,
        win_condition: null,
        mechanism: null,
        standings_sort: null,
        tiebreaker_trigger: null,
        tiebreaker_format: null,
        race_length: null,
      })
      .eq('entity_type', 'league')
      .eq('entity_id', league.id);

    expect(error).toBeNull();
  });
});
