/**
 * @fileoverview Tests for the combo-coherence validator (Phase 4 Unit 4.2).
 *
 * Each test fixture builds a minimal LeagueWizardFormData with only the
 * fields the rule under test cares about — undefined values mimic the
 * mid-wizard state where the LO hasn't reached every step yet.
 */

import { describe, it, expect } from 'vitest';
import { evaluateCombo } from '../comboCoherence';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const customBase: LeagueWizardFormData = {
  'league-format': 'custom',
  'lineup-size': 3,
  'roster-size': 5,
  'match-format': 'double_round_robin',
  'handicap-system': 'points',
  'pairing-format': 'single_rack',
  'points-calculator': 'linear_above_threshold',
  'win-condition': 'games',
  'mechanism': 'extra_games',
  'standings-sort': 'wins_first',
  'tiebreaker': 'best_of_3',
};

describe('evaluateCombo — preset path', () => {
  it('skips evaluation entirely for non-custom formats', () => {
    const result = evaluateCombo({ 'league-format': 'standard_3v3' });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('evaluateCombo — Tested Preset bundles produce zero findings', () => {
  it('BCA 3v3 (linear_above_threshold + games + DRR + 3v3 + single_rack)', () => {
    const result = evaluateCombo(customBase);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('BCA 5v5 (accumulate_with_milestone_jumps + games + SRR + 5v5)', () => {
    const result = evaluateCombo({
      ...customBase,
      'lineup-size': 5,
      'match-format': 'single_round_robin',
      'points-calculator': 'accumulate_with_milestone_jumps',
      'handicap-system': 'percentage',
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('Fargo 5v5 (accumulated_per_game + points + SRR + 5v5)', () => {
    const result = evaluateCombo({
      ...customBase,
      'lineup-size': 5,
      'match-format': 'single_round_robin',
      'points-calculator': 'accumulated_per_game',
      'win-condition': 'points',
      'handicap-system': 'fargo',
      'mechanism': 'start_points',
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('evaluateCombo — ERROR rules', () => {
  it('flags decide-by-points without a calculator', () => {
    const result = evaluateCombo({
      ...customBase,
      'points-calculator': null,
      'win-condition': 'points',
    });
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('error.no_points_to_decide_by');
  });

  it('flags race-to-n + accumulated_per_game (no per-game ball-counts in race format)', () => {
    const result = evaluateCombo({
      ...customBase,
      'pairing-format': 'race_to_n',
      'points-calculator': 'accumulated_per_game',
    });
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('error.race_format_without_ball_count');
  });

  it('does NOT flag race-to-n + linear_above_threshold (no per-game ball-counts needed)', () => {
    const result = evaluateCombo({
      ...customBase,
      'pairing-format': 'race_to_n',
      'points-calculator': 'linear_above_threshold',
    });
    const codes = result.errors.map((e) => e.code);
    expect(codes).not.toContain('error.race_format_without_ball_count');
  });
});

describe('evaluateCombo — WARNING rules', () => {
  it('flags milestone_jumps + 3v3 DRR (18 games, even — ties possible)', () => {
    const result = evaluateCombo({
      ...customBase,
      'points-calculator': 'accumulate_with_milestone_jumps',
    });
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('warning.milestone_jumps_even_games');
  });

  it('does NOT flag milestone_jumps + 5v5 SRR (25 games, odd — no ties)', () => {
    const result = evaluateCombo({
      ...customBase,
      'lineup-size': 5,
      'match-format': 'single_round_robin',
      'points-calculator': 'accumulate_with_milestone_jumps',
      'handicap-system': 'percentage',
    });
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain('warning.milestone_jumps_even_games');
  });

  it('flags off-preset 4v4 + linear_above_threshold (not a Tested Preset)', () => {
    const result = evaluateCombo({
      ...customBase,
      'lineup-size': 4,
      'match-format': 'single_round_robin',
    });
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('warning.off_preset_combo');
  });
});
