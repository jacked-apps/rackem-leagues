/**
 * @fileoverview Factory helpers for common Threshold shapes.
 *
 * A Threshold is a pure `(inputs) → number` function with a name. Each
 * prepackaged Scoring System declares its own thresholds via these helpers
 * or by writing custom compute functions inline. Phase A ships the most
 * commonly-used shapes:
 *
 * - `constantThreshold(name, value)` — returns the same number every time;
 *   used for literal-value thresholds (e.g., milestone jump value = 1.5)
 * - `prefThreshold(name, prefKey)` — reads a value from the prefs bag;
 *   used for thresholds whose value comes directly from a league preference
 *   (e.g., games_to_win)
 * - `computedThreshold(name, fn)` — wraps an arbitrary compute function;
 *   used for thresholds whose value derives from a formula (e.g.,
 *   milestoneTarget = round(games_to_win × milestone_percent))
 *
 * @see ./types.ts — the Threshold interface
 */

import type { Threshold, ThresholdInputs } from './types';

/**
 * A threshold that always returns the same number regardless of inputs.
 * Useful for literal jump values, fixed bonus amounts, etc.
 */
export function constantThreshold(name: string, value: number): Threshold {
  return {
    name,
    compute: () => value,
  };
}

/**
 * A threshold that reads its value from a league preference. The pref's
 * value must be a finite number; throws otherwise (composition error —
 * the composition referenced a pref that isn't numeric).
 */
export function prefThreshold(name: string, prefKey: string): Threshold {
  return {
    name,
    compute: (inputs) => {
      const v = inputs.prefs[prefKey];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error(
          `prefThreshold "${name}" expected numeric pref "${prefKey}", got ${JSON.stringify(v)}`,
        );
      }
      return v;
    },
  };
}

/**
 * A threshold wrapping an arbitrary compute function. The catch-all for
 * thresholds that don't fit a simpler factory shape. May return `null` to
 * express "no value applies" (e.g., a tie target on a chart that doesn't
 * permit ties).
 */
export function computedThreshold(
  name: string,
  fn: (inputs: ThresholdInputs) => number | null,
): Threshold {
  return { name, compute: fn };
}

/**
 * Resolve a map of named thresholds to a map of resolved values. Called once
 * at match start; the resulting bag is what triggers reference at evaluation
 * time. Values may be `number | null`.
 *
 * Throws if any threshold's compute throws (composition error surfaces here
 * rather than at trigger-evaluation time, where it would be harder to debug).
 */
export function resolveAllThresholds(
  thresholds: Record<string, Threshold>,
  inputs: ThresholdInputs,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [key, threshold] of Object.entries(thresholds)) {
    out[key] = threshold.compute(inputs);
  }
  return out;
}
