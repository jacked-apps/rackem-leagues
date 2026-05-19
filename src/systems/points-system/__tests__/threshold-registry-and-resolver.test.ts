/**
 * @fileoverview Tests for the Threshold operation registry + resolver.
 *
 * @see ../threshold-registry.ts — registry under test
 * @see ../threshold-resolver.ts — resolver under test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearThresholdRegistry,
  getThresholdOperation,
  registeredThresholdOperationNames,
  registerThresholdOperation,
} from '../threshold-registry';
import { buildThresholdRow, resolveThreshold } from '../threshold-resolver';
import type {
  ThresholdInputs,
  ThresholdOperation,
  ThresholdRow,
} from '../types';

const emptyInputs: ThresholdInputs = {
  homeRatings: [],
  awayRatings: [],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 0,
  prefs: {},
};

// Test fixtures
const testOperation: ThresholdOperation = {
  name: 'test_constant',
  consumesHandicapType: 'none',
  consumesSize: { kind: 'none' },
  producesOutputType: 'numeric',
  compute: (args) => {
    const v = args.value;
    return typeof v === 'number' ? v : null;
  },
};

const testChartOp: ThresholdOperation = {
  name: 'test_chart_lookup',
  consumesHandicapType: 'points',
  consumesSize: { kind: 'lineup_sizes', sizes: [3] },
  producesOutputType: 'game_target',
  compute: (args, inputs) => {
    // Trivial: return the home handicap diff (proves args + inputs are wired).
    void args;
    return inputs.homeHandicapDiff;
  },
};

beforeEach(() => {
  clearThresholdRegistry();
});

describe('threshold-registry — registerThresholdOperation', () => {
  it('registers and retrieves an operation by name', () => {
    registerThresholdOperation(testOperation);
    expect(getThresholdOperation('test_constant')).toBe(testOperation);
  });

  it('returns undefined for an unregistered name', () => {
    expect(getThresholdOperation('missing')).toBeUndefined();
  });

  it('throws on duplicate registration (collision is a bug, not a no-op)', () => {
    registerThresholdOperation(testOperation);
    expect(() => registerThresholdOperation(testOperation)).toThrow(
      /already registered/,
    );
  });

  it('clearThresholdRegistry empties the registry', () => {
    registerThresholdOperation(testOperation);
    expect(registeredThresholdOperationNames().length).toBe(1);
    clearThresholdRegistry();
    expect(registeredThresholdOperationNames().length).toBe(0);
  });
});

describe('threshold-resolver — buildThresholdRow', () => {
  it('builds a row by looking up the operation and copying metadata', () => {
    registerThresholdOperation(testChartOp);
    const row = buildThresholdRow({
      name: 'homeWinTarget_3man',
      operationKind: 'test_chart_lookup',
      operationArgs: { chart_ref: 'fake_chart' },
    });
    expect(row.name).toBe('homeWinTarget_3man');
    expect(row.expectedHandicapType).toBe('points');
    expect(row.expectedSize).toEqual({ kind: 'lineup_sizes', sizes: [3] });
    expect(row.outputType).toBe('game_target');
    expect(row.operationKind).toBe('test_chart_lookup');
    expect(row.operationArgs).toEqual({ chart_ref: 'fake_chart' });
  });

  it('defaults operationArgs to empty object when omitted', () => {
    registerThresholdOperation(testOperation);
    const row = buildThresholdRow({
      name: 'literal',
      operationKind: 'test_constant',
    });
    expect(row.operationArgs).toEqual({});
  });

  it('throws when the operation is not registered', () => {
    expect(() =>
      buildThresholdRow({
        name: 'broken',
        operationKind: 'never_registered',
      }),
    ).toThrow(/unknown operation/);
  });
});

describe('threshold-resolver — resolveThreshold', () => {
  it('runs the registered operation with row args + inputs', () => {
    registerThresholdOperation(testOperation);
    const row = buildThresholdRow({
      name: 'constant_5',
      operationKind: 'test_constant',
      operationArgs: { value: 5 },
    });
    expect(resolveThreshold(row, emptyInputs)).toBe(5);
  });

  it('passes runtime inputs through to the operation compute', () => {
    registerThresholdOperation(testChartOp);
    const row = buildThresholdRow({
      name: 'homeTarget',
      operationKind: 'test_chart_lookup',
    });
    const inputs = { ...emptyInputs, homeHandicapDiff: 7 };
    expect(resolveThreshold(row, inputs)).toBe(7);
  });

  it('returns null when the operation returns null (e.g., "no value applies")', () => {
    registerThresholdOperation({
      name: 'always_null',
      consumesHandicapType: 'none',
      consumesSize: { kind: 'none' },
      producesOutputType: 'numeric',
      compute: () => null,
    });
    const row = buildThresholdRow({ name: 'n', operationKind: 'always_null' });
    expect(resolveThreshold(row, emptyInputs)).toBeNull();
  });

  it('throws when the operationKind is unknown at resolve time', () => {
    // Construct a row WITHOUT going through buildThresholdRow (simulating a row
    // loaded from a corrupt DB or stale schema).
    const orphan: ThresholdRow = {
      name: 'orphan',
      expectedHandicapType: 'none',
      expectedSize: { kind: 'none' },
      outputType: 'numeric',
      operationKind: 'never_registered',
      operationArgs: {},
    };
    expect(() => resolveThreshold(orphan, emptyInputs)).toThrow(
      /unknown operation/,
    );
  });

  it('throws on drift: row metadata disagreeing with operation declaration', () => {
    registerThresholdOperation(testChartOp);
    // Hand-build a row with a deliberately wrong expectedHandicapType
    const drifted: ThresholdRow = {
      name: 'drifted',
      expectedHandicapType: 'fargo', // operation says 'points'
      expectedSize: { kind: 'lineup_sizes', sizes: [3] },
      outputType: 'game_target',
      operationKind: 'test_chart_lookup',
      operationArgs: {},
    };
    expect(() => resolveThreshold(drifted, emptyInputs)).toThrow(/drift/);
  });

  it('drift check covers expectedSize', () => {
    registerThresholdOperation(testChartOp);
    const drifted: ThresholdRow = {
      name: 'drifted',
      expectedHandicapType: 'points',
      expectedSize: { kind: 'lineup_sizes', sizes: [5] }, // operation says [3]
      outputType: 'game_target',
      operationKind: 'test_chart_lookup',
      operationArgs: {},
    };
    expect(() => resolveThreshold(drifted, emptyInputs)).toThrow(/drift/);
  });

  it('drift check covers outputType', () => {
    registerThresholdOperation(testChartOp);
    const drifted: ThresholdRow = {
      name: 'drifted',
      expectedHandicapType: 'points',
      expectedSize: { kind: 'lineup_sizes', sizes: [3] },
      outputType: 'points_headstart', // operation says 'game_target'
      operationKind: 'test_chart_lookup',
      operationArgs: {},
    };
    expect(() => resolveThreshold(drifted, emptyInputs)).toThrow(/drift/);
  });

  it("accepts 'any' size as matching itself", () => {
    const op: ThresholdOperation = {
      name: 'universal_op',
      consumesHandicapType: 'points',
      consumesSize: { kind: 'lineup_sizes', sizes: 'any' },
      producesOutputType: 'game_target',
      compute: () => 42,
    };
    registerThresholdOperation(op);
    const row = buildThresholdRow({
      name: 'universal',
      operationKind: 'universal_op',
    });
    expect(row.expectedSize).toEqual({ kind: 'lineup_sizes', sizes: 'any' });
    expect(resolveThreshold(row, emptyInputs)).toBe(42);
  });
});
