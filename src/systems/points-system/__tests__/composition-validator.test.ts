/**
 * @fileoverview Tests for composition-build validation.
 *
 * Each rule the validator enforces gets a passing case (implicit — the
 * prepackaged compositions all validate) and a failing case here.
 *
 * @see ../composition-validator.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { validatePointsSystem } from '../composition-validator';
import { buildThresholdRow } from '../threshold-resolver';
// Side-effect imports: register operations the fixtures reference.
import '../operations/read-pref';
import '../allocator-formula-operations/state-diff-times-constant';
import type { PointsSystem, Trigger } from '../types';

function baseComposition(overrides: Partial<PointsSystem>): PointsSystem {
  return {
    name: 'test',
    thresholds: {},
    triggers: [],
    ...overrides,
  };
}

const receiptTrigger = (name: string, thresholdRef: string): Trigger => ({
  name,
  input: { thresholdRef },
  when: { kind: 'receipt' },
  action: {
    target: { kind: 'concrete', variableName: name },
    op: 'assign',
    value: { kind: 'input_ref' },
  },
});

describe('validatePointsSystem — trigger name uniqueness', () => {
  it('throws on duplicate trigger names', () => {
    const composition = baseComposition({
      thresholds: {
        a: buildThresholdRow({ name: 'a', operationKind: 'read_pref', operationArgs: { pref_key: 'x' } }),
      },
      triggers: [receiptTrigger('dup', 'a'), receiptTrigger('dup', 'a')],
    });
    expect(() => validatePointsSystem(composition)).toThrow(/duplicate trigger name/);
  });
});

describe('validatePointsSystem — threshold reference resolution', () => {
  it('throws when a trigger references an unknown threshold', () => {
    const composition = baseComposition({
      thresholds: {},
      triggers: [receiptTrigger('t', 'missingThreshold')],
    });
    expect(() => validatePointsSystem(composition)).toThrow(/unknown threshold/);
  });
});

describe('validatePointsSystem — inputSpec requires input', () => {
  it('throws when a trigger declares inputSpec but no input', () => {
    const composition = baseComposition({
      triggers: [
        {
          name: 'orphanSpec',
          inputSpec: { outputType: 'numeric', outputSide: 'shared' },
          when: { kind: 'match_end' },
          action: {
            target: { kind: 'concrete', variableName: 'x' },
            op: 'assign',
            value: { kind: 'literal', value: 1 },
          },
        },
      ],
    });
    expect(() => validatePointsSystem(composition)).toThrow(/declares inputSpec but has no input/);
  });
});

describe('validatePointsSystem — terminal triggers must be last', () => {
  it('throws when a non-terminal trigger follows a terminal one', () => {
    const composition = baseComposition({
      triggers: [
        {
          name: 'terminalFirst',
          when: { kind: 'match_end' },
          action: { target: { kind: 'concrete', variableName: 'endmatch' }, op: 'assign', value: { kind: 'literal', value: true } },
          terminal: true,
        },
        {
          name: 'afterTerminal',
          when: { kind: 'match_end' },
          action: { target: { kind: 'concrete', variableName: 'x' }, op: 'assign', value: { kind: 'literal', value: 1 } },
        },
      ],
    });
    expect(() => validatePointsSystem(composition)).toThrow(/Terminal triggers must be last/);
  });

  it('allows a terminal trigger as the final element', () => {
    const composition = baseComposition({
      triggers: [
        {
          name: 'onlyTerminal',
          when: { kind: 'match_end' },
          action: { target: { kind: 'concrete', variableName: 'endmatch' }, op: 'assign', value: { kind: 'literal', value: true } },
          terminal: true,
        },
      ],
    });
    expect(() => validatePointsSystem(composition)).not.toThrow();
  });
});

describe('validatePointsSystem — inputSpec shape compatibility', () => {
  it('throws on cross-side wiring (home trigger ← away threshold)', () => {
    // Build a threshold whose output side is 'home' by hand (read_pref is
    // 'shared', so we construct the row directly to force a cross-side case).
    const composition = baseComposition({
      thresholds: {
        homeVal: {
          name: 'homeVal',
          expectedHandicapType: 'none',
          expectedSize: { kind: 'none' },
          outputType: 'game_target',
          outputSide: 'home',
          outputRange: { min: 'unbounded', max: 'unbounded' },
          operationKind: 'read_pref',
          operationArgs: { pref_key: 'x' },
        },
      },
      triggers: [
        {
          name: 'awayTrigger',
          input: { thresholdRef: 'homeVal' },
          inputSpec: { outputType: 'game_target', outputSide: 'away' },
          when: { kind: 'side_reaches', side: 'away', sideVar: 'away_wins' },
          action: { target: { kind: 'concrete', variableName: 'away_points' }, op: 'add', value: { kind: 'input_ref' } },
        },
      ],
    });
    expect(() => validatePointsSystem(composition)).toThrow(/cross-side wiring/);
  });

  it('throws on outputType mismatch', () => {
    const composition = baseComposition({
      thresholds: {
        v: buildThresholdRow({ name: 'v', operationKind: 'read_pref', operationArgs: { pref_key: 'x' } }),
      },
      triggers: [
        {
          name: 'mismatch',
          input: { thresholdRef: 'v' },
          // read_pref produces 'numeric'; expect 'game_target'
          inputSpec: { outputType: 'game_target', outputSide: 'shared' },
          when: { kind: 'receipt' },
          action: { target: { kind: 'concrete', variableName: 'x' }, op: 'assign', value: { kind: 'input_ref' } },
        },
      ],
    });
    expect(() => validatePointsSystem(composition)).toThrow(/expects outputType/);
  });
});

describe('validatePointsSystem — allocator formula references', () => {
  it('throws when an allocator side references an unknown formula operation', () => {
    const composition = baseComposition({
      perGameAllocator: {
        name: 'broken',
        winner: { base: 0, formula: { operationKind: 'never_registered', operationArgs: {} } },
        loser: { base: 0, formula: null },
      },
    });
    expect(() => validatePointsSystem(composition)).toThrow(/unknown formula operation/);
  });

  it('passes when allocator formula references a registered operation', () => {
    const composition = baseComposition({
      perGameAllocator: {
        name: 'ok',
        winner: {
          base: 0,
          formula: {
            operationKind: 'state_diff_times_constant',
            operationArgs: { minuend_var: 'total_games', subtrahend_var: 'home_wins', multiplier: 0.5 },
          },
        },
        loser: { base: 0, formula: null },
      },
    });
    expect(() => validatePointsSystem(composition)).not.toThrow();
  });
});
