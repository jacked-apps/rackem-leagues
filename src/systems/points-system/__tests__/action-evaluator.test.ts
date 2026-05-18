/**
 * @fileoverview Tests for the Action evaluator.
 *
 * @see ../action-evaluator.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateAction,
  resolveValue,
  resolveTarget,
  applyOp,
  type ActionContext,
} from '../action-evaluator';
import type { Action, MatchStateBag } from '../types';

const emptyCtx: ActionContext = { thresholdValues: {}, triggeringSide: null };

describe('resolveValue', () => {
  it('returns literal values directly', () => {
    expect(resolveValue({ kind: 'literal', value: 10 }, {}, emptyCtx)).toBe(10);
    expect(resolveValue({ kind: 'literal', value: 'home' }, {}, emptyCtx)).toBe('home');
    expect(resolveValue({ kind: 'literal', value: true }, {}, emptyCtx)).toBe(true);
    expect(resolveValue({ kind: 'literal', value: null }, {}, emptyCtx)).toBeNull();
  });

  it('resolves threshold_ref from the thresholdValues bag', () => {
    const ctx: ActionContext = {
      thresholdValues: { winTarget: 10 },
      triggeringSide: null,
    };
    expect(resolveValue({ kind: 'threshold_ref', thresholdRef: 'winTarget' }, {}, ctx)).toBe(10);
  });

  it('throws on undefined threshold reference', () => {
    expect(() =>
      resolveValue({ kind: 'threshold_ref', thresholdRef: 'missing' }, {}, emptyCtx),
    ).toThrow(/undefined threshold/);
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

  it('resolves triggering_side from ctx', () => {
    const ctx: ActionContext = { thresholdValues: {}, triggeringSide: 'home' };
    expect(resolveValue({ kind: 'triggering_side' }, {}, ctx)).toBe('home');
  });

  it('throws on triggering_side when no side is set', () => {
    expect(() => resolveValue({ kind: 'triggering_side' }, {}, emptyCtx)).toThrow(
      /no associated side/,
    );
  });
});

describe('resolveTarget', () => {
  it('returns concrete target names directly', () => {
    expect(resolveTarget({ kind: 'concrete', variableName: 'win_chip' }, emptyCtx)).toBe('win_chip');
  });

  it('substitutes <side> in side-scoped templates', () => {
    const ctx: ActionContext = { thresholdValues: {}, triggeringSide: 'away' };
    expect(
      resolveTarget({ kind: 'side_scoped', variableNameTemplate: '<side>_points' }, ctx),
    ).toBe('away_points');
  });

  it('throws when side-scoped template has no triggering side', () => {
    expect(() =>
      resolveTarget({ kind: 'side_scoped', variableNameTemplate: '<side>_points' }, emptyCtx),
    ).toThrow(/no associated side/);
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
  it('assigns a literal to a concrete target', () => {
    const action: Action = {
      target: { kind: 'concrete', variableName: 'win_chip' },
      op: 'assign',
      value: { kind: 'literal', value: 'home' },
    };
    const state: MatchStateBag = {};
    evaluateAction(action, state, emptyCtx);
    expect(state.win_chip).toBe('home');
  });

  it('adds a threshold value to a side-scoped variable (the "give to side" pattern)', () => {
    // "give threshold initialA value to side A"
    const action: Action = {
      target: { kind: 'side_scoped', variableNameTemplate: '<side>_points' },
      op: 'add',
      value: { kind: 'threshold_ref', thresholdRef: 'initialA' },
    };
    const state: MatchStateBag = { home_points: 0 };
    const ctx: ActionContext = {
      thresholdValues: { initialA: 56 },
      triggeringSide: 'home',
    };
    evaluateAction(action, state, ctx);
    expect(state.home_points).toBe(56);
  });

  it('jumps a running total to a literal value (the milestone jump pattern)', () => {
    // "when milestone reached, replace running total with 1.5 for the triggering side"
    const action: Action = {
      target: { kind: 'side_scoped', variableNameTemplate: '<side>_points' },
      op: 'assign',
      value: { kind: 'literal', value: 1.5 },
    };
    const state: MatchStateBag = { home_points: 0.9 };
    const ctx: ActionContext = { thresholdValues: {}, triggeringSide: 'home' };
    evaluateAction(action, state, ctx);
    expect(state.home_points).toBe(1.5);
  });

  it('multiplies a running total by a literal (the points x2 pattern)', () => {
    const action: Action = {
      target: { kind: 'side_scoped', variableNameTemplate: '<side>_points' },
      op: 'multiply',
      value: { kind: 'literal', value: 2 },
    };
    const state: MatchStateBag = { away_points: 5 };
    const ctx: ActionContext = { thresholdValues: {}, triggeringSide: 'away' };
    evaluateAction(action, state, ctx);
    expect(state.away_points).toBe(10);
  });

  it('assigns triggering_side to a signaling variable (the win chip pattern)', () => {
    const action: Action = {
      target: { kind: 'concrete', variableName: 'win_chip' },
      op: 'assign',
      value: { kind: 'triggering_side' },
    };
    const state: MatchStateBag = {};
    const ctx: ActionContext = { thresholdValues: {}, triggeringSide: 'away' };
    evaluateAction(action, state, ctx);
    expect(state.win_chip).toBe('away');
  });
});
