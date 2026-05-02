/**
 * @fileoverview Off-preset combination tests for the points-calculator
 * registry (Phase 1 Unit 1.5).
 *
 * Per supplement Section 8.2: tests must verify the modular guarantee, not
 * just the preset behavior. Characterization tests on the three Tested
 * Presets prove backwards compatibility — but they don't prove the modular
 * composition works. This file does that work.
 *
 * Each calculator is exercised at lineup geometries OTHER than its Tested
 * Preset's lineup size, with non-default params, and with calculator
 * combinations the existing presets don't produce. The point: lineup size
 * is independent of calculator choice. Each calculator works on its
 * declared input + params, no awareness of lineup geometry.
 *
 * Also confirms the registry's `registerTestedPresetCalculators()` actually
 * registers all three under their canonical names.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  getCalculator,
  registerTestedPresetCalculators,
  clearRegistry,
  listCalculators,
  linearAboveThreshold,
  accumulateWithMilestoneJumps,
  accumulatedPerGame,
} from '../index';

const HOME = 'team-home';
const AWAY = 'team-away';

describe('Tested Preset registration', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers all three Tested Preset calculators under canonical names', () => {
    registerTestedPresetCalculators();
    expect(getCalculator('linear_above_threshold')).toBe(linearAboveThreshold);
    expect(getCalculator('accumulate_with_milestone_jumps')).toBe(
      accumulateWithMilestoneJumps,
    );
    expect(getCalculator('accumulated_per_game')).toBe(accumulatedPerGame);
  });

  it('listCalculators includes all three after registration', () => {
    registerTestedPresetCalculators();
    const names = listCalculators();
    expect(names).toContain('linear_above_threshold');
    expect(names).toContain('accumulate_with_milestone_jumps');
    expect(names).toContain('accumulated_per_game');
    expect(names.length).toBe(3);
  });

  it('is idempotent — calling twice does not throw or duplicate', () => {
    registerTestedPresetCalculators();
    expect(() => registerTestedPresetCalculators()).not.toThrow();
    expect(listCalculators().length).toBe(3);
  });
});

describe('off-preset combinations: linear_above_threshold at non-canonical lineup sizes', () => {
  // The Tested Preset for linear_above_threshold is BCA 3v3 (18 games,
  // W=10, T=9 typical). These cases exercise the SAME calculator at
  // lineup sizes that don't match the preset.

  beforeAll(() => {
    clearRegistry();
    registerTestedPresetCalculators();
  });

  it('4v4 single-RR (16 games, W=9, T=8): wins=11 → +2', () => {
    const calc = getCalculator('linear_above_threshold');
    if (calc?.kind !== 'aggregate') throw new Error('expected aggregate calculator');
    const result = calc.compute(
      {
        gamesWon: 11,
        thresholds: { games_to_win: 9, games_to_tie: 8, games_to_lose: 7 },
      },
      { per_extra_game_multiplier: 1 },
    );
    expect(result).toBe(2);
  });

  it('6v6 single-RR (36 games, W=19): wins=25 → +6', () => {
    const calc = getCalculator('linear_above_threshold');
    if (calc?.kind !== 'aggregate') throw new Error('expected aggregate calculator');
    const result = calc.compute(
      {
        gamesWon: 25,
        thresholds: { games_to_win: 19, games_to_tie: 18, games_to_lose: 17 },
      },
      { per_extra_game_multiplier: 1 },
    );
    expect(result).toBe(6);
  });

  it('5v5 single-RR (25 games, no tie possible, W=13): wins=15 → +2', () => {
    // 5v5 SRR at W=13 — would normally use accumulate_with_milestone_jumps
    // (BCA 5v5's Tested Preset). Here we run linear_above_threshold instead
    // — proves an LO can configure a 5v5 league with the simpler linear
    // formula if they prefer.
    const calc = getCalculator('linear_above_threshold');
    if (calc?.kind !== 'aggregate') throw new Error('expected aggregate calculator');
    const result = calc.compute(
      {
        gamesWon: 15,
        thresholds: { games_to_win: 13, games_to_tie: null, games_to_lose: 12 },
      },
      { per_extra_game_multiplier: 1 },
    );
    expect(result).toBe(2);
  });

  it('4v4 with custom multiplier=2: wins=11 (W=9) → +4', () => {
    const calc = getCalculator('linear_above_threshold');
    if (calc?.kind !== 'aggregate') throw new Error('expected aggregate calculator');
    const result = calc.compute(
      {
        gamesWon: 11,
        thresholds: { games_to_win: 9, games_to_tie: 8, games_to_lose: 7 },
      },
      { per_extra_game_multiplier: 2 },
    );
    expect(result).toBe(4);
  });
});

describe('off-preset combinations: accumulate_with_milestone_jumps at non-canonical lineup sizes', () => {
  // Tested Preset is BCA 5v5 (25 games, W=13). Here at other geometries.

  beforeAll(() => {
    clearRegistry();
    registerTestedPresetCalculators();
  });

  it('3v3 DRR (18 games, W=10): wins=12 → in milestone band', () => {
    const calc = getCalculator('accumulate_with_milestone_jumps');
    if (calc?.kind !== 'aggregate') throw new Error('expected aggregate calculator');
    // milestone_target = round(10 * 0.7) = 7
    // wins=12 >= W=10 → win-threshold band: 3.0 + (12-10)*0.1 = 3.2
    const result = calc.compute(
      {
        gamesWon: 12,
        thresholds: { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 },
      },
      accumulateWithMilestoneJumps.defaultParams,
    );
    expect(result).toBeCloseTo(3.2, 5);
  });

  it('6v6 SRR (36 games, W=19) at milestone: wins=13 → 1.5', () => {
    const calc = getCalculator('accumulate_with_milestone_jumps');
    if (calc?.kind !== 'aggregate') throw new Error('expected aggregate calculator');
    // milestone_target = round(19 * 0.7) = round(13.3) = 13
    // wins=13 → at milestone, jump value 1.5
    const result = calc.compute(
      {
        gamesWon: 13,
        thresholds: { games_to_win: 19, games_to_tie: 18, games_to_lose: 17 },
      },
      accumulateWithMilestoneJumps.defaultParams,
    );
    expect(result).toBeCloseTo(1.5, 5);
  });

  it('4v4 DRR (32 games) with custom milestone_percent=0.5: wins=8 (W=16) → 1.5', () => {
    const calc = getCalculator('accumulate_with_milestone_jumps');
    if (calc?.kind !== 'aggregate') throw new Error('expected aggregate calculator');
    // Custom params: milestone_percent=0.5 → milestone_target = round(16*0.5) = 8
    // wins=8 → at milestone, jump value 1.5
    const result = calc.compute(
      {
        gamesWon: 8,
        thresholds: { games_to_win: 16, games_to_tie: 15, games_to_lose: 14 },
      },
      {
        per_game_increment: 0.1,
        milestone_percent: 0.5,
        milestone_jump_value: 1.5,
        win_threshold_jump_value: 3.0,
      },
    );
    expect(result).toBeCloseTo(1.5, 5);
  });
});

describe('off-preset combinations: accumulated_per_game at non-canonical lineup sizes', () => {
  // Tested Preset is Fargo 5v5 10-7. Here at other geometries + custom params.

  beforeAll(() => {
    clearRegistry();
    registerTestedPresetCalculators();
  });

  const game = (
    winner: string | null,
    winner_score: number | null = null,
    loser_score: number | null = null,
    is_tiebreaker = false,
  ) => ({ winner_team_id: winner, winner_score, loser_score, is_tiebreaker });

  it('3v3 DRR (18 games) Fargo 10-7: home wins 10, away pockets various', () => {
    const calc = getCalculator('accumulated_per_game');
    if (calc?.kind !== 'per_game') throw new Error('expected per_game calculator');
    const games = [
      ...Array(10).fill(0).map((_, i) => game(HOME, null, i % 8)),
      ...Array(8).fill(0).map(() => game(AWAY, null, 0)),
    ];
    // home: 10×10 + 8×0 = 100 (away wins, home pocketed 0 each)
    expect(calc.compute({ games, teamId: HOME }, accumulatedPerGame.defaultParams)).toBe(100);
    // away: 8×10 + sum(0..9 mod 8) = 80 + (0+1+2+3+4+5+6+7+0+1) = 80 + 29 = 109
    expect(calc.compute({ games, teamId: AWAY }, accumulatedPerGame.defaultParams)).toBe(109);
  });

  it('4v4 SRR (16 games) with custom 15/X scoring (winner=15, loser counter 0-9)', () => {
    const calc = getCalculator('accumulated_per_game');
    if (calc?.kind !== 'per_game') throw new Error('expected per_game calculator');
    const params = {
      winner: { kind: 'fixed' as const, points: 15 },
      loser: { kind: 'counter' as const, min: 0, max: 9, label: 'Balls pocketed' },
    };
    const games = [
      game(HOME, null, 5),
      game(HOME, null, 3),
      game(AWAY, null, 4),
    ];
    // home: 2×15 + 1×4 (loser counter) = 30 + 4 = 34
    expect(calc.compute({ games, teamId: HOME }, params)).toBe(34);
    // away: 1×15 + 2× their scores = 15 + (5+3) = 23
    expect(calc.compute({ games, teamId: AWAY }, params)).toBe(23);
  });

  it('Pure games-won variant: winner=fixed-1, loser=fixed-0 (tally only)', () => {
    // Used when LO wants "no points formula at all" but win_condition still
    // says points. Effectively same as games-won counting via the points axis.
    const calc = getCalculator('accumulated_per_game');
    if (calc?.kind !== 'per_game') throw new Error('expected per_game calculator');
    const params = {
      winner: { kind: 'fixed' as const, points: 1 },
      loser: { kind: 'fixed' as const, points: 0 },
    };
    const games = [game(HOME), game(HOME), game(AWAY), game(AWAY), game(AWAY)];
    expect(calc.compute({ games, teamId: HOME }, params)).toBe(2); // 2 wins
    expect(calc.compute({ games, teamId: AWAY }, params)).toBe(3); // 3 wins
  });

  it('Both sides counter (LO-driven scoring): winner=counter, loser=counter', () => {
    const calc = getCalculator('accumulated_per_game');
    if (calc?.kind !== 'per_game') throw new Error('expected per_game calculator');
    const params = {
      winner: { kind: 'counter' as const, min: 0, max: 14, label: 'Racks won' },
      loser: { kind: 'counter' as const, min: 0, max: 14, label: 'Racks won' },
    };
    const games = [
      game(HOME, 7, 3),    // home wins 7 racks, away wins 3
      game(AWAY, 8, 6),    // away wins 8, home wins 6
    ];
    // home: 7 (winner) + 6 (loser of game 2) = 13
    expect(calc.compute({ games, teamId: HOME }, params)).toBe(13);
    // away: 3 (loser of game 1) + 8 (winner of game 2) = 11
    expect(calc.compute({ games, teamId: AWAY }, params)).toBe(11);
  });
});

describe('cross-calculator: same league config could use any calculator', () => {
  // Confirms lineup geometry is independent of calculator. The same set of
  // games can be scored through different calculators by changing the
  // league's `points_calculator` axis — the calculators don't know or
  // care about lineup size.

  beforeAll(() => {
    clearRegistry();
    registerTestedPresetCalculators();
  });

  it('a 4v4 league can use any of the three Tested Preset calculators', () => {
    // Aggregate input for 4v4: gamesWon=10 of 16, W=9, T=8
    const aggInput = {
      gamesWon: 10,
      thresholds: { games_to_win: 9, games_to_tie: 8, games_to_lose: 7 },
    };

    const lin = getCalculator('linear_above_threshold');
    const milestone = getCalculator('accumulate_with_milestone_jumps');
    if (lin?.kind !== 'aggregate' || milestone?.kind !== 'aggregate') {
      throw new Error('expected aggregate calculators');
    }

    expect(lin.compute(aggInput, lin.defaultParams)).toBe(1); // 10-9=1
    // milestone: target=round(9*0.7)=6, gamesWon=10 ≥ W=9 → win-threshold: 3 + 1×0.1 = 3.1
    expect(milestone.compute(aggInput, milestone.defaultParams)).toBeCloseTo(3.1, 5);

    // accumulated_per_game requires per-game input; build a games array
    // representing 10 wins for the team across a 16-game match.
    const calc = getCalculator('accumulated_per_game');
    if (calc?.kind !== 'per_game') throw new Error('expected per_game calculator');
    const games = [
      ...Array(10).fill(0).map(() => ({
        winner_team_id: HOME,
        winner_score: null,
        loser_score: 0,
        is_tiebreaker: false,
      })),
      ...Array(6).fill(0).map(() => ({
        winner_team_id: AWAY,
        winner_score: null,
        loser_score: 0,
        is_tiebreaker: false,
      })),
    ];
    // home: 10×10 + 6×0 = 100
    expect(calc.compute({ games, teamId: HOME }, calc.defaultParams)).toBe(100);
  });
});
