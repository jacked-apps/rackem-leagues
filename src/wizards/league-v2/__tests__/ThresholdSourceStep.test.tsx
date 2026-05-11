/**
 * @fileoverview Tests for ThresholdSourceStep's classifier (Phase 4
 * Unit 4.3 of the modular-league-system v2 plan).
 *
 * The component itself is presentational — render testing is light.
 * The pure `classifyThresholdSource` function carries the dispatch
 * logic and is fully testable from form-data fixtures.
 */

import { describe, it, expect } from 'vitest';
import { classifyThresholdSource } from '../steps/ThresholdSourceStep';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const customBase: LeagueWizardFormData = {
  'league-format': 'custom',
};

describe('classifyThresholdSource — Tested Preset combos', () => {
  it('classifies BCA 3v3 (lineup=3, DRR, points handicap, extra_games) as tested_preset_3v3', () => {
    expect(
      classifyThresholdSource({
        ...customBase,
        'lineup-size': 3,
        'match-format': 'double_round_robin',
        'handicap-system': 'points',
        'mechanism': 'extra_games',
        'win-condition': 'games',
      }),
    ).toBe('tested_preset_3v3');
  });

  it('classifies BCA 5v5 (lineup=5, SRR, percentage handicap, extra_games) as tested_preset_5v5', () => {
    expect(
      classifyThresholdSource({
        ...customBase,
        'lineup-size': 5,
        'match-format': 'single_round_robin',
        'handicap-system': 'percentage',
        'mechanism': 'extra_games',
        'win-condition': 'games',
      }),
    ).toBe('tested_preset_5v5');
  });
});

describe('classifyThresholdSource — Fargo combos', () => {
  it('classifies Fargo + start_points as fargo_start_points', () => {
    expect(
      classifyThresholdSource({
        ...customBase,
        'lineup-size': 5,
        'match-format': 'single_round_robin',
        'handicap-system': 'fargo',
        'mechanism': 'start_points',
        'win-condition': 'points',
      }),
    ).toBe('fargo_start_points');
  });

  it('classifies Fargo + win_condition=points as fargo_start_points (regardless of mechanism)', () => {
    // Captures the case where the LO picked points win condition but
    // hasn't reached the mechanism step yet — we still know the
    // start-points formula will apply.
    expect(
      classifyThresholdSource({
        ...customBase,
        'handicap-system': 'fargo',
        'mechanism': 'extra_games',
        'win-condition': 'points',
      }),
    ).toBe('fargo_start_points');
  });

  it('classifies Fargo + games-won + extra_games as fargo_games_won (Unit 3.2 formula)', () => {
    expect(
      classifyThresholdSource({
        ...customBase,
        'lineup-size': 5,
        'match-format': 'single_round_robin',
        'handicap-system': 'fargo',
        'mechanism': 'extra_games',
        'win-condition': 'games',
      }),
    ).toBe('fargo_games_won');
  });

  it('classifies Fargo + games-won at any lineup size as fargo_games_won', () => {
    // The user's actual upcoming league: 5v5 SRR + Fargo + games-won.
    // Also covers 3v3 + Fargo + games-won (a noted off-preset combo).
    expect(
      classifyThresholdSource({
        ...customBase,
        'lineup-size': 3,
        'match-format': 'double_round_robin',
        'handicap-system': 'fargo',
        'mechanism': 'extra_games',
        'win-condition': 'games',
      }),
    ).toBe('fargo_games_won');
  });
});

describe('classifyThresholdSource — manual entry fallback', () => {
  it('classifies 4v4 + percentage + extra_games as manual_entry (off-preset, no calibrated chart)', () => {
    expect(
      classifyThresholdSource({
        ...customBase,
        'lineup-size': 4,
        'match-format': 'single_round_robin',
        'handicap-system': 'percentage',
        'mechanism': 'extra_games',
        'win-condition': 'games',
      }),
    ).toBe('manual_entry');
  });

  it('classifies BCAPL skill_level (no chart yet) as manual_entry', () => {
    expect(
      classifyThresholdSource({
        ...customBase,
        'lineup-size': 5,
        'match-format': 'single_round_robin',
        'handicap-system': 'skill_level',
        'mechanism': 'race_length_adjustment',
        'win-condition': 'games',
      }),
    ).toBe('manual_entry');
  });

  it('classifies 3v3 + points + start_points (off-preset combo) as manual_entry', () => {
    // Points handicap is normally paired with extra_games. start_points
    // has no chart for points-handicap leagues.
    expect(
      classifyThresholdSource({
        ...customBase,
        'lineup-size': 3,
        'match-format': 'double_round_robin',
        'handicap-system': 'points',
        'mechanism': 'start_points',
        'win-condition': 'games',
      }),
    ).toBe('manual_entry');
  });

  it('classifies handicap_type=none as manual_entry (no handicap to look up)', () => {
    expect(
      classifyThresholdSource({
        ...customBase,
        'handicap-system': 'none',
        'mechanism': 'none',
        'win-condition': 'games',
      }),
    ).toBe('manual_entry');
  });
});
