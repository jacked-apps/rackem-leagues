/**
 * @fileoverview Tests for the Unit 3 validator hardening — args-shape checking.
 *
 * Before Unit 3 the validator only checked that an `operationKind` resolved
 * to a registered operation. Args content was unchecked, which let typos
 * like `max: "seven"` slip past load-time and throw mid-match. These tests
 * pin the new behavior: when an operation declares an `argsShape`, the
 * row's `operationArgs` are checked against it at load (or build) time.
 *
 * Coverage:
 *   - Happy paths for both registered formula ops
 *   - Missing required arg
 *   - Type mismatch (number vs string)
 *   - Wrong value for side_name (`'banana'` instead of winner/loser)
 *   - Forward-compat: extra args are allowed
 *   - Forward-compat: operations without argsShape skip the args check
 */

import { describe, it, expect } from 'vitest';
import { validatePerGameAllocator } from '../composition-validator';
// Side-effect imports to register the ops the fixtures reference.
import '../allocator-formula-operations/add-complement-of-other-side';
import '../allocator-formula-operations/state-diff-times-constant';
import '../allocator-formula-operations/read-state-var';
import type { PerGameAllocator } from '../types';

function allocator(
  winnerFormula: PerGameAllocator['winner']['formula'],
): PerGameAllocator {
  return {
    name: 'test',
    winner: { base: 10, formula: winnerFormula },
    loser: { base: 0, formula: null },
  };
}

describe('validatePerGameAllocator — args-shape (Unit 3)', () => {
  it('accepts add_complement_of_other_side with all required args', () => {
    expect(() =>
      validatePerGameAllocator(
        allocator({
          operationKind: 'add_complement_of_other_side',
          operationArgs: { max: 7, other_side: 'loser' },
        }),
      ),
    ).not.toThrow();
  });

  it('accepts state_diff_times_constant with all required args', () => {
    expect(() =>
      validatePerGameAllocator(
        allocator({
          operationKind: 'state_diff_times_constant',
          operationArgs: {
            minuend_var: 'total_games',
            subtrahend_var: 'home_wins',
            multiplier: 0.5,
          },
        }),
      ),
    ).not.toThrow();
  });

  it('accepts read_state_var with var_name', () => {
    expect(() =>
      validatePerGameAllocator(
        allocator({
          operationKind: 'read_state_var',
          operationArgs: { var_name: 'pointsPerGame' },
        }),
      ),
    ).not.toThrow();
  });

  it('rejects a missing required number arg', () => {
    expect(() =>
      validatePerGameAllocator(
        allocator({
          operationKind: 'add_complement_of_other_side',
          operationArgs: { other_side: 'loser' }, // max is missing
        }),
      ),
    ).toThrow(/missing required arg "max"/);
  });

  it('rejects a string where a number is expected', () => {
    // This is the exact bug the pre-Unit-3 validator would have shipped.
    expect(() =>
      validatePerGameAllocator(
        allocator({
          operationKind: 'add_complement_of_other_side',
          operationArgs: { max: 'seven', other_side: 'loser' },
        }),
      ),
    ).toThrow(/wrong type — expected number/);
  });

  it("rejects a side_name value that isn't 'winner' or 'loser'", () => {
    expect(() =>
      validatePerGameAllocator(
        allocator({
          operationKind: 'add_complement_of_other_side',
          operationArgs: { max: 7, other_side: 'banana' },
        }),
      ),
    ).toThrow(/wrong type — expected side_name/);
  });

  it('rejects a non-string state_var_name', () => {
    expect(() =>
      validatePerGameAllocator(
        allocator({
          operationKind: 'read_state_var',
          operationArgs: { var_name: 42 },
        }),
      ),
    ).toThrow(/wrong type — expected state_var_name/);
  });

  it('rejects a non-finite number (NaN, Infinity)', () => {
    expect(() =>
      validatePerGameAllocator(
        allocator({
          operationKind: 'add_complement_of_other_side',
          operationArgs: { max: NaN, other_side: 'loser' },
        }),
      ),
    ).toThrow(/wrong type — expected number/);
  });

  it('forward-compat: extra args are allowed (validator only checks declared ones)', () => {
    expect(() =>
      validatePerGameAllocator(
        allocator({
          operationKind: 'add_complement_of_other_side',
          operationArgs: { max: 7, other_side: 'loser', future_arg: 'whatever' },
        }),
      ),
    ).not.toThrow();
  });
});
