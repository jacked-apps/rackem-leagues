/**
 * @fileoverview Unit tests for wizard form-data → preference-field mappings.
 *
 * Covers the helper functions that translate wizard answers into the
 * shape stored in `preferences.standings_sort` (a 3-element array) and
 * `preferences.tiebreaker_trigger` + `preferences.tiebreaker_format`
 * (a coupled pair). Plus a sanity check that all three shipped presets
 * (fargo_5v5, standard_3v3, standard_5v5) populate every modular axis,
 * so the dual-write upsert never lands a NULL where the resolved view
 * expects a value.
 */

import { describe, it, expect } from 'vitest';
import {
  mapStandingsSort,
  mapTiebreaker,
  PRESET_MAPPINGS,
} from '../presetMappings';

describe('mapStandingsSort', () => {
  it('points_first → points-led priority', () => {
    expect(mapStandingsSort('points_first')).toEqual([
      'points_earned',
      'match_wins',
      'games_won',
    ]);
  });

  it('games_won_first → games-led priority', () => {
    expect(mapStandingsSort('games_won_first')).toEqual([
      'games_won',
      'match_wins',
      'points_earned',
    ]);
  });

  it('wins_first → BCA Classic priority', () => {
    expect(mapStandingsSort('wins_first')).toEqual([
      'match_wins',
      'games_won',
      'points_earned',
    ]);
  });

  it('undefined defaults to BCA Classic priority', () => {
    expect(mapStandingsSort(undefined)).toEqual([
      'match_wins',
      'games_won',
      'points_earned',
    ]);
  });

  it('unknown value defaults to BCA Classic priority (graceful)', () => {
    expect(mapStandingsSort('experimental_sort')).toEqual([
      'match_wins',
      'games_won',
      'points_earned',
    ]);
  });
});

describe('mapTiebreaker', () => {
  it('best_of_3 → (even_total_games_only, best_of_3_short_race)', () => {
    expect(mapTiebreaker('best_of_3')).toEqual({
      tiebreaker_trigger: 'even_total_games_only',
      tiebreaker_format: 'best_of_3_short_race',
    });
  });

  it('single_short_race → (even_total_games_only, single_short_race)', () => {
    expect(mapTiebreaker('single_short_race')).toEqual({
      tiebreaker_trigger: 'even_total_games_only',
      tiebreaker_format: 'single_short_race',
    });
  });

  it('accept_tie → (never, accept_tie)', () => {
    expect(mapTiebreaker('accept_tie')).toEqual({
      tiebreaker_trigger: 'never',
      tiebreaker_format: 'accept_tie',
    });
  });

  it('manual → (even_total_games_only, manual) — graceful fallback per Unit 4.4', () => {
    expect(mapTiebreaker('manual')).toEqual({
      tiebreaker_trigger: 'even_total_games_only',
      tiebreaker_format: 'manual',
    });
  });

  it('undefined defaults to (never, accept_tie) — safest non-tiebreaker', () => {
    expect(mapTiebreaker(undefined)).toEqual({
      tiebreaker_trigger: 'never',
      tiebreaker_format: 'accept_tie',
    });
  });

  it('unknown value defaults to (never, accept_tie) — graceful', () => {
    expect(mapTiebreaker('experimental_tiebreaker')).toEqual({
      tiebreaker_trigger: 'never',
      tiebreaker_format: 'accept_tie',
    });
  });
});

describe('PRESET_MAPPINGS — every preset populates all 13 modular axes', () => {
  // The resolved view defaults missing axes, so an incomplete preset
  // technically still works. But it's a smell and easy to slip past
  // review — this test locks the contract that every preset is fully
  // explicit about what scoring shape it represents.
  const REQUIRED_AXES = [
    'lineup_size',
    'max_roster_size',
    'game_generation',
    'handicap_type',
    'pairing_format',
    'points_calculator',
    'points_calculator_params',
    'win_condition',
    'mechanism',
    'standings_sort',
    'tiebreaker_trigger',
    'tiebreaker_format',
  ] as const;

  for (const presetKey of Object.keys(PRESET_MAPPINGS)) {
    describe(presetKey, () => {
      const preferences = PRESET_MAPPINGS[presetKey].preferences as Record<
        string,
        unknown
      >;
      for (const axis of REQUIRED_AXES) {
        it(`has a value for ${axis}`, () => {
          expect(preferences[axis]).toBeDefined();
          // standings_sort must be a non-empty array
          if (axis === 'standings_sort') {
            expect(Array.isArray(preferences[axis])).toBe(true);
            expect((preferences[axis] as unknown[]).length).toBeGreaterThan(0);
          }
        });
      }
    });
  }

  it('fargo_5v5 uses accumulated_per_game + start_points (calibrated combo)', () => {
    const prefs = PRESET_MAPPINGS.fargo_5v5.preferences;
    expect(prefs.handicap_type).toBe('fargo');
    expect(prefs.points_calculator).toBe('accumulated_per_game');
    expect(prefs.mechanism).toBe('start_points');
    expect(prefs.win_condition).toBe('points');
  });

  it('standard_3v3 uses linear_above_threshold + extra_games and triggers tiebreakers (18 games)', () => {
    const prefs = PRESET_MAPPINGS.standard_3v3.preferences;
    expect(prefs.handicap_type).toBe('points');
    expect(prefs.points_calculator).toBe('linear_above_threshold');
    expect(prefs.mechanism).toBe('extra_games');
    expect(prefs.win_condition).toBe('games');
    expect(prefs.tiebreaker_trigger).toBe('even_total_games_only');
    expect(prefs.tiebreaker_format).toBe('best_of_3_short_race');
  });

  it('standard_5v5 uses accumulate_with_milestone_jumps + extra_games and skips tiebreakers (25 games — odd)', () => {
    const prefs = PRESET_MAPPINGS.standard_5v5.preferences;
    expect(prefs.handicap_type).toBe('percentage');
    expect(prefs.points_calculator).toBe('accumulate_with_milestone_jumps');
    expect(prefs.mechanism).toBe('extra_games');
    expect(prefs.win_condition).toBe('games');
    expect(prefs.tiebreaker_trigger).toBe('never');
  });
});
