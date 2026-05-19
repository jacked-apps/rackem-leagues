/**
 * @fileoverview Tests for the Action evaluator.
 *
 * @see ../action-evaluator.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateAction,
  resolveValue,
  applyOp,
  type ActionContext,
} from '../action-evaluator';
import type { Action, MatchStateBag } from '../types';

const emptyCtx: ActionContext = { inputValue: undefined };

describe('resolveValue', () => {
  it('returns literal values directly', () => {
    expect(resolveValue({ kind: 'literal', value: 10 }, {}, emptyCtx)).toBe(10);
    expect(resolveValue({ kind: 'literal', value: 'home' }, {}, emptyCtx)).toBe('home');
    expect(resolveValue({ kind: 'literal', value: true }, {}, emptyCtx)).toBe(true);
    expect(resolveValue({ kind: 'literal', value: null }, {}, emptyCtx)).toBeNull();
  });

  it('resolves input_ref to the trigger\'s bound input value', () => {
    const ctx: ActionContext = { inputValue: 10 };
    expect(resolveValue({ kind: 'input_ref' }, {}, ctx)).toBe(10);
  });

  it('resolves input_ref to null when the bound input resolved to null', () => {
    const ctx: ActionContext = { inputValue: null };
    expect(resolveValue({ kind: 'input_ref' }, {}, ctx)).toBeNull();
  });

  it('throws on input_ref when the trigger has no input', () => {
    expect(() => resolveValue({ kind: 'input_ref' }, {}, emptyCtx)).toThrow(
      /no input/,
    );
  });

  it('resolves variable_ref from the state bag', () => {
    const state: MatchStateBag = { home_points: 5 };
    expect(
      resolveValue({ kind: 'variable_ref', variableName: 'home_points' }, state, emptyCtx),
    ).toBe(5);
  });

  it('throws on undefined variable reference', () => {
    expect(() =>
      resolveValue({ kind: 'variable_ref', variableName: 'missing' }, {}, emptyCtx),
    ).toThrow(/undefined variable/);
  });
});

describe('applyOp', () => {
  it('assign replaces current with next', () => {
    expect(applyOp('assign', 5, 10)).toBe(10);
    expect(applyOp('assign', undefined, 'home')).toBe('home');
    expect(applyOp('assign', null, true)).toBe(true);
  });

  it('add does numeric addition', () => {
    expect(applyOp('add', 5, 10)).toBe(15);
    expect(applyOp('add', 0.1, 0.2)).toBeCloseTo(0.3);
  });

  it('multiply does numeric multiplication', () => {
    expect(applyOp('multiply', 5, 3)).toBe(15);
    expect(applyOp('multiply', 1.5, 2)).toBe(3);
  });

  it('throws on add/multiply with non-numeric operands', () => {
    expect(() => applyOp('add', 'home', 5)).toThrow(/numeric operands/);
    expect(() => applyOp('multiply', 5, true)).toThrow(/numeric operands/);
    expect(() => applyOp('add', undefined, 5)).toThrow(/numeric operands/);
  });
});

describe('evaluateAction — end-to-end mutations', () => {
  it('assigns a literal to a concrete target (the edge-marker pattern)', () => {
    const action: Action = {
      target: { kind: 'concrete', variableName: 'edge' },
      op: 'assign',
      value: { kind: 'literal', value: 'home' },
    };
    const state: MatchStateBag = {};
    evaluateAction(action, state, emptyCtx);
    expect(state.edge).toBe('home');
  });

  it('adds the trigger\'s input value to a concrete target (the start-points pattern)', () => {
    const action: Action = {
      target: { kind: 'concrete', variableName: 'home_points' },
      op: 'add',
      value: { kind: 'input_ref' },
    };
    const state: MatchStateBag = { home_points: 0 };
    const ctx: ActionContext = { inputValue: 56 };
    evaluateAction(action, state, ctx);
    expect(state.home_points).toBe(56);
  });

  it('adds a literal constant to a concrete target (the milestone-bonus pattern)', () => {
    // "when home reaches milestone, add 1.5 to home_points" — 1.5 is a constant
    // on the trigger row, not a separate threshold.
    const action: Action = {
      target: { kind: 'concrete', variableName: 'home_points' },
      op: 'add',
      value: { kind: 'literal', value: 1.5 },
    };
    const state: MatchStateBag = { home_points: 0.9 };
    evaluateAction(action, state, emptyCtx);
    expect(state.home_points).toBe(2.4);
  });

  it('multiplies a running total by a literal (the points x2 pattern)', () => {
    const action: Action = {
      target: { kind: 'concrete', variableName: 'away_points' },
      op: 'multiply',
      value: { kind: 'literal', value: 2 },
    };
    const state: MatchStateBag = { away_points: 5 };
    evaluateAction(action, state, emptyCtx);
    expect(state.away_points).toBe(10);
  });

  it('assigns a literal boolean to a concrete target (the endmatch pattern)', () => {
    const action: Action = {
      target: { kind: 'concrete', variableName: 'endmatch' },
      op: 'assign',
      value: { kind: 'literal', value: true },
    };
    const state: MatchStateBag = {};
    evaluateAction(action, state, emptyCtx);
    expect(state.endmatch).toBe(true);
  });
});
