/**
 * @fileoverview Tests for the per-game allocator evaluator.
 *
 * Covers the locked SideConfig shape (base + formula) plus the canonical
 * patterns the prepackaged systems use plus the 17-Point + state-reading
 * formula patterns via registered operations.
 *
 * @see ../allocator-evaluator.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { evaluateAllocator } from '../allocator-evaluator';
// Side-effect imports: register the operations these tests reference.
import '../allocator-formula-operations/add-complement-of-other-side';
import '../allocator-formula-operations/state-diff-times-constant';
import type { MatchStateBag, PerGameAllocator } from '../types';

const zeroState: Readonly<MatchStateBag> = {
  home_wins: 0,
  away_wins: 0,
  home_points: 0,
  away_points: 0,
  games_played: 0,
  total_games: 25,
};

describe('evaluateAllocator — Percentage 5-Man pattern (winner=0.1 fixed, loser=0 fixed)', () => {
  const allocator: PerGameAllocator = {
    name: 'percent_5v5',
    winner: { base: 0.1, formula: null },
    loser: { base: 0, formula: null },
  };

  it('home wins → winner contributes 0.1, loser contributes 0', () => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
      zeroState,
    );
    expect(result).toEqual({ winnerContribution: 0.1, loserContribution: 0 });
  });

  it("away wins → same contributions (which side won doesn't change values)", () => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'away', winnerCounterInput: null, loserCounterInput: null },
      zeroState,
    );
    expect(result).toEqual({ winnerContribution: 0.1, loserContribution: 0 });
  });
});

describe('evaluateAllocator — 10-Point pattern (winner=10 fixed, loser=range 0-7 input)', () => {
  const allocator: PerGameAllocator = {
    name: '10pt',
    winner: { base: 10, formula: null },
    loser: {
      base: { min: 0, max: 7, label: 'Balls pocketed by loser' },
      formula: null,
    },
  };

  it.each([0, 1, 3, 5, 7])('loser pocketed %i balls', (input) => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: input },
      zeroState,
    );
    expect(result).toEqual({ winnerContribution: 10, loserContribution: input });
  });

  it('clamps loser counter input above max', () => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: 10 },
      zeroState,
    );
    expect(result.loserContribution).toBe(7); // clamped to max
  });

  it('clamps loser counter input below min', () => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: -3 },
      zeroState,
    );
    expect(result.loserContribution).toBe(0); // clamped to min
  });

  it('throws when a side with a SideInputRange base has no scorer input', () => {
    expect(() =>
      evaluateAllocator(
        allocator,
        { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
        zeroState,
      ),
    ).toThrow(/no scorer input/);
  });
});

describe('evaluateAllocator — 17-Point formula pattern (zero-sum 17 per game)', () => {
  // 17-Point: winner gets (10 base) + (7 - loser's pocketed balls)
  //           loser gets the pocketed balls (0-7)
  //           total per game = 17 always
  const allocator: PerGameAllocator = {
    name: 'seventeen_point',
    winner: {
      base: 10,
      formula: {
        operationKind: 'add_complement_of_other_side',
        operationArgs: { max: 7, other_side: 'loser' },
      },
    },
    loser: {
      base: { min: 0, max: 7, label: 'Balls pocketed by loser' },
      formula: null,
    },
  };

  it.each([
    { balls: 0, expectedWinner: 17, expectedLoser: 0 },
    { balls: 3, expectedWinner: 14, expectedLoser: 3 },
    { balls: 5, expectedWinner: 12, expectedLoser: 5 },
    { balls: 7, expectedWinner: 10, expectedLoser: 7 },
  ])(
    'loser pocketed $balls → winner gets $expectedWinner, loser gets $expectedLoser (total always 17)',
    ({ balls, expectedWinner, expectedLoser }) => {
      const result = evaluateAllocator(
        allocator,
        { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: balls },
        zeroState,
      );
      expect(result.winnerContribution).toBe(expectedWinner);
      expect(result.loserContribution).toBe(expectedLoser);
      expect(result.winnerContribution + result.loserContribution).toBe(17);
    },
  );

  it('changing the base shifts winner output proportionally', () => {
    // Same formula shape, base=12 instead of 10 — "modified" 19-total variant.
    const modified: PerGameAllocator = {
      ...allocator,
      winner: {
        base: 12,
        formula: {
          operationKind: 'add_complement_of_other_side',
          operationArgs: { max: 7, other_side: 'loser' },
        },
      },
    };
    const result = evaluateAllocator(
      modified,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: 3 },
      zeroState,
    );
    expect(result.winnerContribution).toBe(12 + 7 - 3); // 16
    expect(result.loserContribution).toBe(3);
  });
});

describe('evaluateAllocator — formula reading state bag (behind-boost pattern)', () => {
  // Behind-boost: winner gets (total_games - home_wins) * 0.5
  // Reads TWO state variables in one formula — total_games (match-level)
  // and home_wins (cumulative). Demonstrates universal state bag access
  // from inside allocator formulas.
  const allocator: PerGameAllocator = {
    name: 'behind_boost',
    winner: {
      base: 0,
      formula: {
        operationKind: 'state_diff_times_constant',
        operationArgs: {
          minuend_var: 'total_games',
          subtrahend_var: 'home_wins',
          multiplier: 0.5,
        },
      },
    },
    loser: { base: 0, formula: null },
  };

  it('home_wins=0 in a 25-game match → winner gets (25-0)*0.5 = 12.5', () => {
    const state: Readonly<MatchStateBag> = { ...zeroState, total_games: 25, home_wins: 0 };
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
      state,
    );
    expect(result.winnerContribution).toBe(12.5);
  });

  it('home_wins=10 in a 25-game match → winner gets (25-10)*0.5 = 7.5', () => {
    const state: Readonly<MatchStateBag> = { ...zeroState, total_games: 25, home_wins: 10 };
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
      state,
    );
    expect(result.winnerContribution).toBe(7.5);
  });

  it('home_wins=25 (impossible mid-match but illustrative) → winner gets 0', () => {
    const state: Readonly<MatchStateBag> = { ...zeroState, total_games: 25, home_wins: 25 };
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
      state,
    );
    expect(result.winnerContribution).toBe(0);
  });
});

describe('evaluateAllocator — error cases', () => {
  it('throws when formula references unregistered operation', () => {
    const broken: PerGameAllocator = {
      name: 'broken',
      winner: {
        base: 0,
        formula: { operationKind: 'never_registered', operationArgs: {} },
      },
      loser: { base: 0, formula: null },
    };
    expect(() =>
      evaluateAllocator(
        broken,
        { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
        zeroState,
      ),
    ).toThrow(/unknown operation/);
  });
});
