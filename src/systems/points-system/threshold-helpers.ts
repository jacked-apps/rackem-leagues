/**
 * @fileoverview Threshold resolution helpers.
 *
 * Phase A's `threshold-helpers.ts` originally exported function-valued
 * factory helpers (`constantThreshold`, `prefThreshold`, `computedThreshold`)
 * that produced legacy `Threshold` instances with inline compute functions.
 *
 * **Slice 5 of the Threshold refactor (2026-05-19):** legacy helpers removed.
 * Thresholds are now data-shaped `ThresholdRow`s referencing registered
 * operations; `buildThresholdRow()` from `./threshold-resolver` is the
 * canonical way to construct them.
 *
 * This file now exports only `resolveAllThresholds()` — the bulk resolver
 * the runtime calls at match start.
 *
 * @see ./threshold-resolver.ts — `buildThresholdRow()` + `resolveThreshold()`
 * @see ./threshold-registry.ts — operation registry
 */

import { resolveThreshold } from './threshold-resolver';
import type { ThresholdInputs, ThresholdRow } from './types';

/**
 * Resolve a map of named thresholds to a map of resolved values. Called once
 * at match start; the resulting bag is what triggers reference at evaluation
 * time. Values may be `number | null`.
 *
 * Throws if any threshold's operation throws (composition error surfaces here
 * rather than at trigger-evaluation time, where it would be harder to debug).
 */
export function resolveAllThresholds(
  thresholds: Record<string, ThresholdRow>,
  inputs: ThresholdInputs,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [key, threshold] of Object.entries(thresholds)) {
    out[key] = resolveThreshold(threshold, inputs);
  }
  return out;
}
