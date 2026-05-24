/**
 * @fileoverview Unit tests for the trigger CONDITION evaluator (the "if" check).
 *
 * Covers `always`, each comparison operator, reading variables off the state bag,
 * and the NEVER-BREAK contract: an unevaluable condition (missing/non-numeric
 * variable) returns `{ ok: false, reason }` rather than throwing, so the caller
 * treats the trigger as not firing instead of crashing scoring.
 */

import { describe, it, expect } from 'vitest';
import { evaluateCondition, type Condition } from '../condition-evaluator';
import type { MatchStateBag } from '../types';

const state: MatchStateBag = {
  home_wins: 9,
  away_wins: 7,
  winTarget: 9,
  flag: true,
};

/** Helper: assert success and return the boolean. */
function value(cond: Condition): boolean {
  const r = evaluateCondition(cond, state);
  if (!r.ok) throw new Error(`expected ok, got failure: ${r.reason}`);
  return r.value;
}

describe('evaluateCondition', () => {
  it('always is true', () => {
    expect(value({ kind: 'always' })).toBe(true);
  });

  it('equality: home_wins == winTarget (the milestone/win pattern)', () => {
    expect(
      value({
        kind: 'compare',
        left: { kind: 'var', name: 'home_wins' },
        op: '==',
        right: { kind: 'var', name: 'winTarget' },
      }),
    ).toBe(true);
    expect(
      value({
        kind: 'compare',
        left: { kind: 'var', name: 'away_wins' },
        op: '==',
        right: { kind: 'var', name: 'winTarget' },
      }),
    ).toBe(false);
  });

  it('handles > < >= <= against a constant', () => {
    const cmp = (op: '>' | '<' | '>=' | '<=', n: number): Condition => ({
      kind: 'compare',
      left: { kind: 'var', name: 'home_wins' }, // 9
      op,
      right: { kind: 'const', value: n },
    });
    expect(value(cmp('>', 8))).toBe(true);
    expect(value(cmp('>', 9))).toBe(false);
    expect(value(cmp('<', 10))).toBe(true);
    expect(value(cmp('>=', 9))).toBe(true);
    expect(value(cmp('<=', 9))).toBe(true);
    expect(value(cmp('<=', 8))).toBe(false);
  });

  it('missing variable returns a failure (does NOT throw)', () => {
    const r = evaluateCondition(
      { kind: 'compare', left: { kind: 'var', name: 'nope' }, op: '==', right: { kind: 'const', value: 1 } },
      state,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not a finite number/);
  });

  it('non-numeric variable returns a failure (does NOT throw)', () => {
    const r = evaluateCondition(
      { kind: 'compare', left: { kind: 'var', name: 'flag' }, op: '==', right: { kind: 'const', value: 1 } },
      state,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not a finite number/);
  });
});
