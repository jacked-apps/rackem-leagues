/**
 * @fileoverview Tests for the per-game handicap virtuals exposed by
 * `evaluate_expression`. The runtime resolves `this_side_handicap` and
 * `other_side_handicap` based on the role this formula is computing for
 * AND the actual game-record per-player handicaps.
 */

import { describe, it, expect } from 'vitest';
import { evaluateExpressionOperation } from '../allocator-formula-operations/evaluate-expression';
import type { FormulaContext, MatchStateBag } from '../types';

const STATE: MatchStateBag = {};

function ctx(
  thisSide: 'winner' | 'loser',
  winnerSide: 'home' | 'away',
  winnerHandicap: number | null | undefined,
  loserHandicap: number | null | undefined,
): FormulaContext {
  return {
    winner: 0,
    loser: 0,
    thisSide,
    winnerSide,
    winnerHandicap,
    loserHandicap,
  };
}

describe('evaluate_expression — per-game handicap virtuals', () => {
  it('this_side_handicap resolves to winnerHandicap when computing the winner side', () => {
    const r = evaluateExpressionOperation.compute(
      { expression: { kind: 'var', name: 'this_side_handicap' } },
      ctx('winner', 'home', 42, 28),
      STATE,
    );
    expect(r).toBe(42);
  });

  it('this_side_handicap resolves to loserHandicap when computing the loser side', () => {
    const r = evaluateExpressionOperation.compute(
      { expression: { kind: 'var', name: 'this_side_handicap' } },
      ctx('loser', 'home', 42, 28),
      STATE,
    );
    expect(r).toBe(28);
  });

  it('other_side_handicap is the mirror image', () => {
    expect(
      evaluateExpressionOperation.compute(
        { expression: { kind: 'var', name: 'other_side_handicap' } },
        ctx('winner', 'home', 42, 28),
        STATE,
      ),
    ).toBe(28);
    expect(
      evaluateExpressionOperation.compute(
        { expression: { kind: 'var', name: 'other_side_handicap' } },
        ctx('loser', 'home', 42, 28),
        STATE,
      ),
    ).toBe(42);
  });

  it('falls back to 0 when handicaps are missing (null / undefined)', () => {
    expect(
      evaluateExpressionOperation.compute(
        { expression: { kind: 'var', name: 'this_side_handicap' } },
        ctx('winner', 'home', null, null),
        STATE,
      ),
    ).toBe(0);
    expect(
      evaluateExpressionOperation.compute(
        { expression: { kind: 'var', name: 'other_side_handicap' } },
        ctx('winner', 'home', undefined, undefined),
        STATE,
      ),
    ).toBe(0);
  });

  it("evaluates an expression like (other_side_handicap - this_side_handicap)", () => {
    // Underdog bonus pattern: winner gets points based on the gap between
    // their handicap and the loser's. Negative when winner is stronger.
    const expr = {
      kind: 'op' as const,
      op: '-' as const,
      left: { kind: 'var' as const, name: 'other_side_handicap' },
      right: { kind: 'var' as const, name: 'this_side_handicap' },
    };
    // Winner=40, loser=60 → underdog winner (40 vs 60) gets (60 - 40) = 20.
    const r = evaluateExpressionOperation.compute(
      { expression: expr },
      ctx('winner', 'home', 40, 60),
      STATE,
    );
    expect(r).toBe(20);
  });
});
