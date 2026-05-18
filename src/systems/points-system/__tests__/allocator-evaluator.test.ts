/**
 * @fileoverview Tests for the per-game allocator evaluator.
 *
 * Covers the 3 per-side config kinds (fixed / counter / formula) plus the
 * canonical patterns the 3 prepackaged systems use plus the 17-Point
 * formula case.
 *
 * @see ../allocator-evaluator.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { evaluateAllocator, type AllocatorCumulativeState } from '../allocator-evaluator';
import type { PerGameAllocator } from '../types';

const zeroState: AllocatorCumulativeState = {
  home: { wins: 0, points: 0 },
  away: { wins: 0, points: 0 },
};

describe('evaluateAllocator — Percentage 5-Man pattern (winner=0.1 fixed, loser=0 fixed)', () => {
  const allocator: PerGameAllocator = {
    name: 'percent_5v5',
    winner: { kind: 'fixed', points: 0.1 },
    loser: { kind: 'fixed', points: 0 },
  };

  it('home wins → winner contributes 0.1, loser contributes 0', () => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
      zeroState,
    );
    expect(result).toEqual({ winnerContribution: 0.1, loserContribution: 0 });
  });

  it('away wins → same contributions (which side won doesn\'t change values)', () => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'away', winnerCounterInput: null, loserCounterInput: null },
      zeroState,
    );
    expect(result).toEqual({ winnerContribution: 0.1, loserContribution: 0 });
  });
});

describe('evaluateAllocator — FargoRate 10-Point pattern (winner=10 fixed, loser=counter 0-7)', () => {
  const allocator: PerGameAllocator = {
    name: 'fargo_10_7',
    winner: { kind: 'fixed', points: 10 },
    loser: { kind: 'counter', min: 0, max: 7, label: 'Balls pocketed by loser' },
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

  it('throws on missing counter input when side is a counter', () => {
    expect(() =>
      evaluateAllocator(
        allocator,
        { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
        zeroState,
      ),
    ).toThrow(/Counter side requires a numeric input/);
  });
});

describe('evaluateAllocator — 17-Point formula pattern', () => {
  // 17-Point: winner_side = formula(base=10, formula: ctx.winner + (7 - ctx.loser))
  //           loser_side  = counter 0-7
  const allocator: PerGameAllocator = {
    name: 'seventeen_point',
    winner: {
      kind: 'formula',
      base: 10,
      formula: (ctx) => ctx.winner + (7 - ctx.loser),
    },
    loser: { kind: 'counter', min: 0, max: 7, label: 'Balls pocketed by loser' },
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
    // Same formula shape, base=12 instead of 10 — "modified 17-Point with 19 total"
    const modified: PerGameAllocator = {
      ...allocator,
      winner: {
        kind: 'formula',
        base: 12,
        formula: (ctx) => ctx.winner + (7 - ctx.loser),
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

describe('evaluateAllocator — formula with cumulative match-state context (diminishing returns)', () => {
  // Ed's "diminishing returns" example:
  // winner_side = formula(base=10, formula: ctx.thisSide === 'home'
  //   ? 10 - (ctx.home.wins - ctx.away.wins)
  //   : 10 - (ctx.away.wins - ctx.home.wins))
  const allocator: PerGameAllocator = {
    name: 'diminishing_returns',
    winner: {
      kind: 'formula',
      base: 10,
      formula: (ctx) =>
        ctx.thisSide === 'home'
          ? 10 - (ctx.home.wins - ctx.away.wins)
          : 10 - (ctx.away.wins - ctx.home.wins),
    },
    loser: { kind: 'fixed', points: 0 },
  };

  it('with equal wins, winner gets full 10', () => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
      { home: { wins: 3, points: 0 }, away: { wins: 3, points: 0 } },
    );
    expect(result.winnerContribution).toBe(10);
  });

  it('home ahead by 2 → home wins next game with 8 points', () => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null },
      { home: { wins: 5, points: 0 }, away: { wins: 3, points: 0 } },
    );
    expect(result.winnerContribution).toBe(8); // 10 - (5-3)
  });

  it('away wins from behind → away gets 12 points (catch-up bonus)', () => {
    const result = evaluateAllocator(
      allocator,
      { winnerSide: 'away', winnerCounterInput: null, loserCounterInput: null },
      { home: { wins: 5, points: 0 }, away: { wins: 3, points: 0 } },
    );
    expect(result.winnerContribution).toBe(12); // 10 - (3-5) = 10 - (-2) = 12
  });
});
