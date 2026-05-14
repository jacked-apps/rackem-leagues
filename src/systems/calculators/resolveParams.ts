/**
 * @fileoverview Resolve calculator params, applying the empty-fallback to
 * the calculator's `defaultParams`.
 *
 * Why this exists: the league wizard writes `{}` to
 * `preferences.points_calculator_params` for any league that uses the
 * calculator's defaults unmodified. The `compute()` function in each
 * calculator handles this case internally (`if (isEmpty) resolvedParams =
 * defaults`), but `scoringPopupFields()` and other call sites do NOT —
 * they expect the canonical params shape. Without this helper, those call
 * sites blow up with "cannot read properties of undefined" when the
 * league hasn't customized params.
 *
 * Originally lived as a private helper inside UnifiedScoreboard.tsx during
 * the unified-scoreboard branch. Branch A's modal rework needed the same
 * resolution path, so it was extracted here for shared use.
 *
 * @see docs/plans/2026-05-05-001-feat-scoring-modal-plumbing-plan.md
 *   (Branch A Unit 4 — wired ScoringDialog to consume scoringPopupFields)
 */

import { getCalculator } from './index';

/**
 * Resolve calculator params: when the snapshot/preferences store an empty
 * object `{}` (the wizard's default for unmodified-from-defaults leagues),
 * fall back to the calculator's `defaultParams`. Mirrors the same fallback
 * logic the calculator's own `compute()` already does, so display + math
 * stay in agreement.
 *
 * Returns the input params untouched when:
 *   - `calculatorName` is null/undefined or `'none'` (no calculator active)
 *   - The calculator name doesn't resolve to a registered calculator
 *
 * Returns the calculator's `defaultParams` when:
 *   - `params` is null/undefined
 *   - `params` is an empty object `{}`
 *
 * Otherwise returns the input params untouched (assumed canonical).
 */
export function resolveCalculatorParams(
  calculatorName: string | null | undefined,
  params: unknown,
): unknown {
  if (!calculatorName || calculatorName === 'none') return params;
  const calc = getCalculator(calculatorName);
  if (!calc) return params;
  const isEmpty =
    params == null ||
    (typeof params === 'object' && Object.keys(params as object).length === 0);
  return isEmpty ? calc.defaultParams : params;
}
