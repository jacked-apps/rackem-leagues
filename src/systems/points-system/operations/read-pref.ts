/**
 * @fileoverview Threshold operation: read a numeric value from league prefs.
 *
 * Implements the `'read_pref'` operation kind. Used for LO-tunable constants
 * (milestone jump values, win-threshold jump values, per-game increments,
 * milestone percentages, etc.) that live in the league's preferences and
 * need to be referenced from triggers through the named-threshold system
 * per the single-mechanism principle.
 *
 * **Arg shape:**
 *  - `pref_key: string` — which key to read from `inputs.prefs`
 *
 * **Registered declarations:**
 *  - consumesHandicapType: `'none'` (doesn't consume handicaps)
 *  - consumesSize: `{ kind: 'none' }` (doesn't consume team/individual inputs)
 *  - producesOutputType: `'numeric'` (generic LO-tunable value)
 *
 * Throws if the pref isn't a finite number — composition error surfaced at
 * resolve time, not silent NaN propagation.
 */

import { registerThresholdOperation } from '../threshold-registry';
import type { ThresholdOperation } from '../types';

export const readPrefOperation: ThresholdOperation = {
  name: 'read_pref',
  consumesHandicapType: 'none',
  consumesSize: { kind: 'none' },
  producesOutputType: 'numeric',
  compute: (args, inputs) => {
    const key = args.pref_key;
    if (typeof key !== 'string') {
      throw new Error(
        `read_pref: args.pref_key must be a string, got ${JSON.stringify(key)}`,
      );
    }
    const v = inputs.prefs[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(
        `read_pref: pref "${key}" expected numeric value, got ${JSON.stringify(v)}`,
      );
    }
    return v;
  },
};

export function registerReadPref(): void {
  registerThresholdOperation(readPrefOperation);
}

registerReadPref();
