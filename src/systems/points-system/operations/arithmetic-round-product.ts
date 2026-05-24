/**
 * @fileoverview Threshold operation: round(prefs[a] × prefs[b]).
 *
 * Implements the `'arithmetic_round_product'` operation kind. Used for
 * derived values like the Percentage 5-Man milestone target:
 *   `milestoneTarget = round(games_to_win × milestone_percent)`
 *
 * **Arg shape:**
 *  - `factor_pref_keys: [string, string]` — the two pref keys to multiply
 *
 * **Registered declarations:**
 *  - consumesHandicapType: `'none'`
 *  - consumesSize: `{ kind: 'none' }`
 *  - producesOutputType: `'numeric'`
 *
 * Throws if either pref isn't a finite number, or args aren't the expected
 * shape — composition error surfaces at resolve time.
 *
 * **Why specific rather than generic:** for Phase A we ship one specific
 * arithmetic operation rather than a generic "evaluate expression" operation.
 * Generic expression evaluation is future work (pipeline decomposition would
 * naturally cover it). For now, each arithmetic shape we actually need gets
 * its own named operation.
 */

import { registerThresholdOperation } from '../threshold-registry';
import type { ThresholdOperation } from '../types';

export const arithmeticRoundProductOperation: ThresholdOperation = {
  name: 'arithmetic_round_product',
  consumesHandicapType: 'none',
  consumesSize: { kind: 'none' },
  producesOutputType: 'numeric',
  // Product of two league-wide prefs; applies equally to both sides.
  producesOutputSide: 'shared',
  // Open numeric range — the factors could be any numbers.
  producesOutputRange: { min: 'unbounded', max: 'unbounded' },
  compute: (args, inputs) => {
    const keys = args.factor_pref_keys;
    if (!Array.isArray(keys) || keys.length !== 2) {
      throw new Error(
        `arithmetic_round_product: args.factor_pref_keys must be [string, string], got ${JSON.stringify(keys)}`,
      );
    }
    const [keyA, keyB] = keys;
    if (typeof keyA !== 'string' || typeof keyB !== 'string') {
      throw new Error(
        `arithmetic_round_product: both factor_pref_keys entries must be strings`,
      );
    }
    const a = inputs.prefs[keyA];
    const b = inputs.prefs[keyB];
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      throw new Error(
        `arithmetic_round_product: pref "${keyA}" expected numeric, got ${JSON.stringify(a)}`,
      );
    }
    if (typeof b !== 'number' || !Number.isFinite(b)) {
      throw new Error(
        `arithmetic_round_product: pref "${keyB}" expected numeric, got ${JSON.stringify(b)}`,
      );
    }
    return Math.round(a * b);
  },
};

export function registerArithmeticRoundProduct(): void {
  registerThresholdOperation(arithmeticRoundProductOperation);
}

registerArithmeticRoundProduct();
