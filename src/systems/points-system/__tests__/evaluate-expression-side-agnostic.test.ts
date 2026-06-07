/**
 * @fileoverview Tests for the side-agnostic name resolution inside the
 * `evaluate_expression` allocator-formula recipe.
 *
 * The workshop's "available data" list exposes virtual names like
 * `this_side_wins` and `other_side_wins`. The recipe resolves these to
 * the right `home_wins` / `away_wins` state-bag entry based on:
 *   - which actual team won THIS game (`ctx.winnerSide`)
 *   - which side this formula is computing for (`ctx.thisSide`)
 *
 * Without this, a formula "winner gets `home_wins` points" would
 * unfairly short-change away-team winners every game. With this, the
 * same formula written as "winner gets `this_side_wins` points" gives
 * each winner their OWN running win count.
 */

import { describe, it, expect } from 'vitest';
import { evaluateExpressionOperation } from '../allocator-formula-operations/evaluate-expression';
import type { FormulaContext, MatchStateBag } from '../types';

const STATE: MatchStateBag = {
  home_wins: 5,
  away_wins: 2,
  home_points: 33,
  away_points: 14,
  games_played: 7,
  total_games: 25,
};

function ctx(
  thisSide: 'winner' | 'loser',
  winnerSide: 'home' | 'away',
): FormulaContext {
  return { winner: 0, loser: 0, thisSide, winnerSide };
}

describe('evaluate_expression — side-agnostic name resolution', () => {
  it('this_side_wins → home_wins when winner-side formula runs on a home-won game', () => {
    const result = evaluateExpressionOperation.compute(
      { expression: { kind: 'var', name: 'this_side_wins' } },
      ctx('winner', 'home'),
      STATE,
    );
    expect(result).toBe(5);
  });

  it('this_side_wins → away_wins when winner-side formula runs on an away-won game', () => {
    const result = evaluateExpressionOperation.compute(
      { expression: { kind: 'var', name: 'this_side_wins' } },
      ctx('winner', 'away'),
      STATE,
    );
    expect(result).toBe(2);
  });

  it('this_side_wins → away_wins when loser-side formula runs on a home-won game (loser is away)', () => {
    const result = evaluateExpressionOperation.compute(
      { expression: { kind: 'var', name: 'this_side_wins' } },
      ctx('loser', 'home'),
      STATE,
    );
    expect(result).toBe(2);
  });

  it('other_side_wins is the mirror image', () => {
    expect(
      evaluateExpressionOperation.compute(
        { expression: { kind: 'var', name: 'other_side_wins' } },
        ctx('winner', 'home'),
        STATE,
      ),
    ).toBe(2);
    expect(
      evaluateExpressionOperation.compute(
        { expression: { kind: 'var', name: 'other_side_wins' } },
        ctx('winner', 'away'),
        STATE,
      ),
    ).toBe(5);
  });

  it('this_side_points + 2 evaluates the expression with the resolved value', () => {
    const expr = {
      kind: 'op' as const,
      op: '+' as const,
      left: { kind: 'var' as const, name: 'this_side_points' },
      right: { kind: 'const' as const, value: 2 },
    };
    // winner side of a home-won game → this_side_points = home_points = 33
    expect(
      evaluateExpressionOperation.compute({ expression: expr }, ctx('winner', 'home'), STATE),
    ).toBe(35);
    // winner side of an away-won game → this_side_points = away_points = 14
    expect(
      evaluateExpressionOperation.compute({ expression: expr }, ctx('winner', 'away'), STATE),
    ).toBe(16);
  });

  it('Real state-bag names (games_played, total_games) still resolve directly', () => {
    expect(
      evaluateExpressionOperation.compute(
        { expression: { kind: 'var', name: 'games_played' } },
        ctx('winner', 'home'),
        STATE,
      ),
    ).toBe(7);
    expect(
      evaluateExpressionOperation.compute(
        { expression: { kind: 'var', name: 'total_games' } },
        ctx('winner', 'home'),
        STATE,
      ),
    ).toBe(25);
  });
});
