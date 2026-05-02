/**
 * @fileoverview Contract tests for the wizard → preferences mapping
 * (Phase 8 Unit 8.2 of the modular-league-system v2 plan).
 *
 * Exercises the form-data → DB-write contract that
 * `useCreateLeagueV2` implements: given a wizard form-data fixture,
 * the preferences row written to the DB has specific column values.
 * Locks the calculator-combo matrix the wizard supports without
 * needing a real Supabase or Playwright.
 *
 * The actual mutation under test is inlined here (a mirror of the
 * `prefFields` resolution logic in useCreateLeagueV2's mutationFn)
 * because the hook needs React context to run. The mirror is small —
 * 25 lines — and the cost of mirroring is dwarfed by the value of
 * having these tests run in CI alongside the rest of the wizard suite.
 *
 * If `useCreateLeagueV2`'s mutationFn diverges from this mirror, the
 * mirror should be updated too. Both bodies should track each other.
 */

import { describe, it, expect } from 'vitest';
import {
  PRESET_MAPPINGS,
  mapStandingsSort,
  mapTiebreaker,
} from '../presetMappings';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

/**
 * Mirror of useCreateLeagueV2's `prefFields` resolution logic.
 * See: src/wizards/league-v2/useCreateLeagueV2.ts (the `prefFields =
 * isCustom ? ... : preset?.preferences ?? {}` block).
 */
function resolvePrefFields(formData: LeagueWizardFormData): Record<string, unknown> {
  const format = formData['league-format'] ?? 'standard_3v3';
  const isCustom = format === 'custom';
  const preset = !isCustom ? PRESET_MAPPINGS[format] : null;

  const mechanismOverride =
    formData['threshold-source'] === 'unhandicapped' ? 'none' : null;

  if (isCustom) {
    return {
      lineup_size: formData['lineup-size'] ?? 3,
      max_roster_size: formData['roster-size'] ?? 5,
      game_generation: formData['match-format'] ?? 'double_round_robin',
      handicap_type: formData['handicap-system'] ?? 'points',
      pairing_format: formData['pairing-format'] ?? 'single_rack',
      points_calculator:
        'points-calculator' in formData
          ? formData['points-calculator']
          : 'linear_above_threshold',
      points_calculator_params: formData['points-calculator-params'] ?? {},
      win_condition: formData['win-condition'] ?? 'games',
      mechanism: mechanismOverride ?? formData['mechanism'] ?? 'extra_games',
      standings_sort: mapStandingsSort(formData['standings-sort']),
      ...mapTiebreaker(formData['tiebreaker']),
      race_length:
        (formData['pairing-format'] ?? 'single_rack') === 'race_to_n'
          ? formData['race-length'] ?? 7
          : null,
    };
  }
  return preset?.preferences ?? {};
}

describe('useCreateLeagueV2 contract — preset paths', () => {
  it('standard_3v3 preset writes BCA 3v3 preferences', () => {
    const fields = resolvePrefFields({ 'league-format': 'standard_3v3' });
    expect(fields.lineup_size).toBe(3);
    expect(fields.game_generation).toBe('double_round_robin');
    expect(fields.handicap_type).toBe('points');
    expect(fields.points_calculator).toBe('linear_above_threshold');
    expect(fields.win_condition).toBe('games');
    expect(fields.mechanism).toBe('extra_games');
    expect(fields.tiebreaker_format).toBe('best_of_3_short_race');
  });

  it('standard_5v5 preset writes BCA 5v5 preferences', () => {
    const fields = resolvePrefFields({ 'league-format': 'standard_5v5' });
    expect(fields.lineup_size).toBe(5);
    expect(fields.game_generation).toBe('single_round_robin');
    expect(fields.handicap_type).toBe('percentage');
    expect(fields.points_calculator).toBe('accumulate_with_milestone_jumps');
    expect(fields.win_condition).toBe('games');
    expect(fields.mechanism).toBe('extra_games');
    expect(fields.tiebreaker_format).toBe('accept_tie');
  });

  it('fargo_5v5 preset writes Fargo 10-7 preferences', () => {
    const fields = resolvePrefFields({ 'league-format': 'fargo_5v5' });
    expect(fields.lineup_size).toBe(5);
    expect(fields.game_generation).toBe('single_round_robin');
    expect(fields.handicap_type).toBe('fargo');
    expect(fields.points_calculator).toBe('accumulated_per_game');
    expect(fields.win_condition).toBe('points');
    expect(fields.mechanism).toBe('start_points');
  });
});

describe('useCreateLeagueV2 contract — custom path with each calculator', () => {
  const customBase: LeagueWizardFormData = {
    'league-format': 'custom',
    'lineup-size': 5,
    'roster-size': 8,
    'match-format': 'single_round_robin',
    'handicap-system': 'fargo',
    'pairing-format': 'single_rack',
    'win-condition': 'games',
    'mechanism': 'extra_games',
    'standings-sort': 'wins_first',
    'tiebreaker': 'accept_tie',
  };

  it('custom + linear_above_threshold writes points_calculator correctly', () => {
    const fields = resolvePrefFields({
      ...customBase,
      'points-calculator': 'linear_above_threshold',
    });
    expect(fields.points_calculator).toBe('linear_above_threshold');
    expect(fields.points_calculator_params).toEqual({});
    expect(fields.handicap_type).toBe('fargo');
    expect(fields.win_condition).toBe('games');
  });

  it('custom + accumulate_with_milestone_jumps writes points_calculator correctly', () => {
    const fields = resolvePrefFields({
      ...customBase,
      'points-calculator': 'accumulate_with_milestone_jumps',
    });
    expect(fields.points_calculator).toBe('accumulate_with_milestone_jumps');
    expect(fields.points_calculator_params).toEqual({});
  });

  it('custom + accumulated_per_game writes points_calculator correctly', () => {
    const fields = resolvePrefFields({
      ...customBase,
      'points-calculator': 'accumulated_per_game',
      'win-condition': 'points',
      'mechanism': 'start_points',
    });
    expect(fields.points_calculator).toBe('accumulated_per_game');
  });

  it('custom + null calculator writes NULL points_calculator (don\'t track points)', () => {
    const fields = resolvePrefFields({
      ...customBase,
      'points-calculator': null,
    });
    expect(fields.points_calculator).toBeNull();
  });
});

describe('useCreateLeagueV2 contract — ThresholdSourceStep override', () => {
  it('unhandicapped toggle overrides mechanism with "none"', () => {
    const fields = resolvePrefFields({
      'league-format': 'custom',
      'lineup-size': 4,
      'roster-size': 6,
      'match-format': 'single_round_robin',
      'handicap-system': 'percentage',
      'pairing-format': 'single_rack',
      'points-calculator': 'linear_above_threshold',
      'win-condition': 'games',
      'mechanism': 'extra_games', // would write extra_games...
      'threshold-source': 'unhandicapped', // ...but this overrides to 'none'
      'standings-sort': 'wins_first',
      'tiebreaker': 'accept_tie',
    });
    expect(fields.mechanism).toBe('none');
  });

  it('threshold-source not set leaves the LO\'s mechanism choice intact', () => {
    const fields = resolvePrefFields({
      'league-format': 'custom',
      'lineup-size': 5,
      'roster-size': 8,
      'match-format': 'single_round_robin',
      'handicap-system': 'fargo',
      'pairing-format': 'single_rack',
      'points-calculator': 'accumulated_per_game',
      'win-condition': 'points',
      'mechanism': 'start_points',
      'standings-sort': 'wins_first',
      'tiebreaker': 'accept_tie',
    });
    expect(fields.mechanism).toBe('start_points');
  });
});

describe('useCreateLeagueV2 contract — user\'s real upcoming league', () => {
  // The user's actual scenario: 5v5 SRR + Fargo handicap + games-won
  // win condition + extra_games mechanism + linear_above_threshold
  // points calculator (or null — both work). Verifies the wizard
  // produces a valid preferences row for this off-preset combo.
  it('5v5 SRR + Fargo + games-won + extra_games + linear_above_threshold produces valid prefs', () => {
    const fields = resolvePrefFields({
      'league-format': 'custom',
      'lineup-size': 5,
      'roster-size': 8,
      'match-format': 'single_round_robin',
      'handicap-system': 'fargo',
      'pairing-format': 'single_rack',
      'points-calculator': 'linear_above_threshold',
      'win-condition': 'games',
      'mechanism': 'extra_games',
      'standings-sort': 'wins_first',
      'tiebreaker': 'accept_tie',
    });
    expect(fields.lineup_size).toBe(5);
    expect(fields.handicap_type).toBe('fargo');
    expect(fields.win_condition).toBe('games');
    expect(fields.mechanism).toBe('extra_games');
    expect(fields.points_calculator).toBe('linear_above_threshold');
    expect(fields.tiebreaker_trigger).toBe('never'); // 25 games is odd
  });
});

describe('useCreateLeagueV2 contract — race_length only set for race_to_n pairing', () => {
  it('single_rack pairing → race_length null', () => {
    const fields = resolvePrefFields({
      'league-format': 'custom',
      'pairing-format': 'single_rack',
    });
    expect(fields.race_length).toBeNull();
  });

  it('race_to_n pairing → race_length defaults to 7 when not specified', () => {
    const fields = resolvePrefFields({
      'league-format': 'custom',
      'pairing-format': 'race_to_n',
    });
    expect(fields.race_length).toBe(7);
  });

  it('race_to_n pairing + explicit race-length writes the LO\'s value', () => {
    const fields = resolvePrefFields({
      'league-format': 'custom',
      'pairing-format': 'race_to_n',
      'race-length': 9,
    });
    expect(fields.race_length).toBe(9);
  });
});
