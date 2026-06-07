/**
 * @fileoverview Tests for the threshold `evaluate_expression` operation
 * (Unit 2 of the threshold room). Resolves a formula over ThresholdInputs via
 * side-agnostic this_side/other_side virtuals; never throws (null + warn).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  evaluateThresholdExpressionOperation as OP,
  registerEvaluateThresholdExpression,
} from '../evaluate-threshold-expression';
import { registeredThresholdOperationNames } from '../../threshold-registry';
import type { Expression, ThresholdInputs } from '../../types';

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

const v = (name: string): Expression => ({ kind: 'var', name });
const c = (value: number): Expression => ({ kind: 'const', value });
const op = (o: '+' | '-' | '*' | '/', left: Expression, right: Expression): Expression => ({
  kind: 'op',
  op: o,
  left,
  right,
});

describe('evaluate_expression (threshold) — happy paths', () => {
  it('resolves a mirrored formula: home perspective vs away perspective', () => {
    const expr = op('-', v('this_side_team_handicap'), v('other_side_team_handicap'));
    const i = inputs({ homeTeamHandicap: 12, awayTeamHandicap: 9 });
    expect(OP.compute({ expression: expr, side: 'home' }, i)).toBe(3);
    expect(OP.compute({ expression: expr, side: 'away' }, i)).toBe(-3);
  });

  it('reads a neutral virtual (game_count) regardless of side', () => {
    const expr = op('*', v('game_count'), c(0.5));
    const i = inputs({ gameCount: 18 });
    expect(OP.compute({ expression: expr }, i)).toBe(9);
  });

  it('reads this_side_rating_sum from the bound side', () => {
    const expr = v('this_side_rating_sum');
    const i = inputs({ homeRatings: [400, 450, 500], awayRatings: [600] });
    expect(OP.compute({ expression: expr, side: 'home' }, i)).toBe(1350);
    expect(OP.compute({ expression: expr, side: 'away' }, i)).toBe(600);
  });

  it('resolves a constant-only (side-less) formula', () => {
    expect(OP.compute({ expression: c(5) }, inputs())).toBe(5);
  });
});

describe('evaluate_expression (threshold) — never-throw failures', () => {
  it('returns null + warn on an unknown virtual', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(OP.compute({ expression: v('nope_not_a_var') }, inputs())).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns null + warn on divide-by-zero', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(OP.compute({ expression: op('/', c(5), c(0)) }, inputs())).toBeNull();
    warnSpy.mockRestore();
  });

  it('returns null + warn when args.expression is not an Expression tree', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(OP.compute({ expression: 'not a tree' }, inputs())).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('evaluate_expression (threshold) — declarations + registration', () => {
  it('producesOutputSide follows the binding side', () => {
    const fn = OP.producesOutputSide as (a: Record<string, unknown>) => string;
    expect(fn({ side: 'home' })).toBe('home');
    expect(fn({ side: 'away' })).toBe('away');
    expect(fn({})).toBe('shared');
  });

  it('registers itself in the threshold registry on import', () => {
    expect(registeredThresholdOperationNames()).toContain('evaluate_expression');
  });

  it('re-registration helper is exported (idempotent guard lives in registry)', () => {
    expect(typeof registerEvaluateThresholdExpression).toBe('function');
  });
});
