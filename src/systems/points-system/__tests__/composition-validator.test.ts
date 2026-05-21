/**
 * @fileoverview Tests for composition-build validation.
 *
 * The new trigger model removes the old input/inputSpec/terminal fields, so the
 * validator's surface narrowed to two enforced rules:
 *   1. Trigger names are unique within a composition.
 *   2. Allocator formula references resolve to a registered operation.
 *
 * Each rule gets a failing case here; the passing cases are implicit (the
 * prepackaged compositions all validate at build time).
 *
 * @see ../composition-validator.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { validatePointsSystem } from '../composition-validator';
// Side-effect import: register the operation the allocator fixture references.
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

/** Build a minimal match_start trigger that sets a literal into `target`. */
const setTrigger = (name: string, target: string): Trigger => ({
  name,
  type: 'match_start',
  condition: { kind: 'always' },
  action: { target, value: { kind: 'set', value: 1 } },
  rearm: 'single_shot',
  order: { number: 1, beforeAllocator: false },
});

describe('validatePointsSystem — trigger name uniqueness', () => {
  it('throws on duplicate trigger names', () => {
    const composition = baseComposition({
      triggers: [setTrigger('dup', 'x'), setTrigger('dup', 'y')],
    });
    expect(() => validatePointsSystem(composition)).toThrow(/duplicate trigger name/);
  });

  it('passes when trigger names are unique', () => {
    const composition = baseComposition({
      triggers: [setTrigger('a', 'x'), setTrigger('b', 'y')],
    });
    expect(() => validatePointsSystem(composition)).not.toThrow();
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
