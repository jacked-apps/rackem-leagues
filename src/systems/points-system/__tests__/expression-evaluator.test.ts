/**
 * @fileoverview Unit tests for the trigger ACTION expression evaluator.
 *
 * Covers each operator, nesting (parentheses via tree shape), reading variables
 * off the state bag, and the NEVER-BREAK contract: bad math (divide-by-zero,
 * missing/non-numeric variable, non-finite result) returns `{ ok: false, reason }`
 * rather than throwing, so the caller can log + skip without crashing scoring.
 */

import { describe, it, expect } from 'vitest';
import { evaluateExpression, type Expression } from '../expression-evaluator';
import type { MatchStateBag } from '../types';

const state: MatchStateBag = {
  home_wins: 11,
  winTarget: 9,
  multiplier: 2,
  zero: 0,
  flag: true,
};

/** Helper: assert success and return the value. */
function value(expr: Expression): number {
  const r = evaluateExpression(expr, state);
  if (!r.ok) throw new Error(`expected ok, got failure: ${r.reason}`);
  return r.value;
}

describe('evaluateExpression', () => {
  it('returns a constant', () => {
    expect(value({ kind: 'const', value: 1.5 })).toBe(1.5);
  });

  it('reads a variable off the state bag', () => {
    expect(value({ kind: 'var', name: 'home_wins' })).toBe(11);
  });

  it('adds, subtracts, multiplies, divides', () => {
    expect(value({ kind: 'op', op: '+', left: { kind: 'const', value: 2 }, right: { kind: 'const', value: 3 } })).toBe(5);
    expect(value({ kind: 'op', op: '-', left: { kind: 'const', value: 9 }, right: { kind: 'const', value: 4 } })).toBe(5);
    expect(value({ kind: 'op', op: '*', left: { kind: 'const', value: 3 }, right: { kind: 'const', value: 4 } })).toBe(12);
    expect(value({ kind: 'op', op: '/', left: { kind: 'const', value: 10 }, right: { kind: 'const', value: 4 } })).toBe(2.5);
  });

  it('evaluates a nested expression: (home_wins - winTarget) * multiplier', () => {
    const expr: Expression = {
      kind: 'op',
      op: '*',
      left: {
        kind: 'op',
        op: '-',
        left: { kind: 'var', name: 'home_wins' },
        right: { kind: 'var', name: 'winTarget' },
      },
      right: { kind: 'var', name: 'multiplier' },
    };
    // (11 - 9) * 2 = 4
    expect(value(expr)).toBe(4);
  });

  it('divide-by-zero returns a failure (does NOT throw)', () => {
    const expr: Expression = {
      kind: 'op',
      op: '/',
      left: { kind: 'const', value: 5 },
      right: { kind: 'var', name: 'zero' },
    };
    const r = evaluateExpression(expr, state);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/divide-by-zero/);
  });

  it('missing variable returns a failure (does NOT throw)', () => {
    const r = evaluateExpression({ kind: 'var', name: 'nope' }, state);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not a finite number/);
  });

  it('non-numeric variable returns a failure (does NOT throw)', () => {
    const r = evaluateExpression({ kind: 'var', name: 'flag' }, state);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not a finite number/);
  });
});
