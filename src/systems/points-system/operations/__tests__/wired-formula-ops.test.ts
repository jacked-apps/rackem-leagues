/**
 * @fileoverview Tests for the newly-wired formula threshold operations:
 * games_needed_3v3_formula (points), games_needed_5v5_formula (percentage), and
 * fargo_games_won (fargo). Each wraps an existing byte-exact implementation and
 * declares its handicap encoding.
 */

import { describe, it, expect, vi } from 'vitest';
import { gamesNeeded3v3FormulaOp, gamesNeeded5v5FormulaOp } from '../games-needed-formula';
import { fargoGamesWonOp } from '../fargo-games-won';
import { registeredThresholdOperationNames } from '../../threshold-registry';
import type { ThresholdInputs } from '../../types';

function inputs(overrides: Partial<ThresholdInputs> = {}): ThresholdInputs {
  return {
    homeRatings: [],
    awayRatings: [],
    homeHandicapDiff: 0,
    awayHandicapDiff: 0,
    gameCount: 18,
    prefs: {},
    ...overrides,
  };
}

describe('games_needed_3v3_formula (points, any size)', () => {
  it('resolves the byte-exact formula (diff 0 -> win 10, tie 9, lose 8)', () => {
    const i = inputs({ homeHandicapDiff: 0 });
    expect(gamesNeeded3v3FormulaOp.compute({ side: 'home', output_field: 'games_to_win' }, i)).toBe(10);
    expect(gamesNeeded3v3FormulaOp.compute({ side: 'home', output_field: 'games_to_tie' }, i)).toBe(9);
    expect(gamesNeeded3v3FormulaOp.compute({ side: 'home', output_field: 'games_to_lose' }, i)).toBe(8);
  });

  it('reads the away side for the mirror', () => {
    const i = inputs({ awayHandicapDiff: -3 });
    expect(gamesNeeded3v3FormulaOp.compute({ side: 'away', output_field: 'games_to_win' }, i)).toBe(8);
  });

  it('declares the points encoding and any size', () => {
    expect(gamesNeeded3v3FormulaOp.consumesHandicapType).toBe('points');
    expect(gamesNeeded3v3FormulaOp.consumesSize).toEqual({ kind: 'lineup_sizes', sizes: 'any' });
  });
});

describe('games_needed_5v5_formula (percentage, any size)', () => {
  it('resolves to a finite number and declares percentage encoding', () => {
    const value = gamesNeeded5v5FormulaOp.compute({ side: 'home', output_field: 'games_to_win' }, inputs());
    expect(Number.isFinite(value as number)).toBe(true);
    expect(gamesNeeded5v5FormulaOp.consumesHandicapType).toBe('percentage');
  });
});

describe('fargo_games_won (fargo, any size)', () => {
  it('resolves a games-to-win threshold from the rating arrays', () => {
    const i = inputs({ homeRatings: [550, 550, 550], awayRatings: [450, 450, 450], gameCount: 18 });
    const value = fargoGamesWonOp.compute({ side: 'home', output_field: 'games_to_win' }, i);
    expect(Number.isFinite(value as number)).toBe(true);
  });

  it('returns null + warn on empty lineups (no throw)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(fargoGamesWonOp.compute({ side: 'home', output_field: 'games_to_win' }, inputs())).toBeNull();
    warnSpy.mockRestore();
  });

  it('declares the fargo encoding', () => {
    expect(fargoGamesWonOp.consumesHandicapType).toBe('fargo');
  });
});

describe('registration', () => {
  it('registers all three new operations', () => {
    const names = registeredThresholdOperationNames();
    expect(names).toContain('games_needed_3v3_formula');
    expect(names).toContain('games_needed_5v5_formula');
    expect(names).toContain('fargo_games_won');
  });
});
