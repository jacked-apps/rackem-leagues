/**
 * @fileoverview Points-calculator registry — looks up a calculator by its
 * stored name (Phase 1 Unit 1.1 of the modular-league-system v2 plan).
 *
 * The registry is the runtime dispatch point for the calculator-as-type
 * pattern. The per-game scoring mutation reads `points_calculator` from the
 * match's snapshot, calls `getCalculator(name)`, and feeds it the input
 * shape it declares.
 *
 * Population: this Unit 1.1 ships an empty registry. Units 1.2 / 1.3 / 1.4
 * register the three Tested Preset calculators (linear_above_threshold,
 * accumulate_with_milestone_jumps, accumulated_per_game). New calculator
 * types add themselves to the registry via `registerCalculator` —
 * intentionally open-ended so future calculators don't require a runtime
 * code path change beyond registering themselves.
 *
 * `null` is a valid value for `points_calculator` on a league preference
 * (means "don't track points at all"). The registry never sees `null` —
 * the per-game scoring mutation short-circuits before calling
 * `getCalculator` when `points_calculator` is null.
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 1.1)
 */

import type { PointsCalculator } from './types';

// ============================================================================
// Registry
// ============================================================================

/**
 * The calculator registry. Maps calculator name → calculator definition.
 * Populated by Units 1.2–1.4 via {@link registerCalculator}.
 *
 * Values are typed as `PointsCalculator<unknown>` because the registry holds
 * heterogeneous calculators with different param shapes. Callers narrow by
 * checking the calculator's `kind` and trusting the calculator's own
 * `paramSchema` to validate the params object.
 */
const registry = new Map<string, PointsCalculator<unknown>>();

/**
 * Register a calculator under its `name`. Units 1.2–1.4 call this from their
 * top-level module so the calculator is available at app start.
 *
 * Throws if a calculator with the same name is already registered — a
 * collision indicates a bug (e.g. two source files registering the same
 * calculator). Tests can call {@link clearRegistry} between cases.
 */
export function registerCalculator<P>(calculator: PointsCalculator<P>): void {
  if (registry.has(calculator.name)) {
    throw new Error(
      `[calculators] Duplicate registration: a calculator named "${calculator.name}" is already registered`,
    );
  }
  registry.set(calculator.name, calculator as PointsCalculator<unknown>);
}

/**
 * Look up a calculator by name. Returns `null` if no calculator with that
 * name is registered (caller handles the missing case — typical pattern is
 * console.warn + zero-points fallback, never a throw, per the plan's
 * graceful-degradation principle).
 *
 * @param name The calculator's stored name (e.g. `'linear_above_threshold'`).
 *             Should match a value previously passed to `registerCalculator`.
 *             Typically read from `preferences.points_calculator` or
 *             `match.system_snapshot.points_calculator`.
 */
export function getCalculator(
  name: string | null | undefined,
): PointsCalculator<unknown> | null {
  if (name == null) return null;
  return registry.get(name) ?? null;
}

/**
 * List all registered calculator names. Useful for the wizard's calculator
 * picker (which iterates the registry to render cards) and for diagnostics.
 */
export function listCalculators(): ReadonlyArray<string> {
  return Array.from(registry.keys());
}

/**
 * Clear the registry. Intended for tests only — production code never calls
 * this. Tests use it to set up isolated calculator fixtures without bleeding
 * registrations between cases.
 */
export function clearRegistry(): void {
  registry.clear();
}

// Re-export types for convenience: `import { getCalculator, type PointsCalculator } from '@/systems/calculators'`
export type {
  PointsCalculator,
  AggregatePointsCalculator,
  PerGamePointsCalculator,
  AggregateInput,
  PerGameInput,
  ScoringPopupFieldSpec,
  ScoringPopupSideSpec,
} from './types';

// Re-export the three Tested Preset calculators for direct import + their params types.
export { linearAboveThreshold } from './linear_above_threshold';
export { accumulateWithMilestoneJumps } from './accumulate_with_milestone_jumps';
export { accumulatedPerGame } from './accumulated_per_game';
export type { LinearAboveThresholdParams } from './linear_above_threshold';
export type { MilestoneJumpsParams } from './accumulate_with_milestone_jumps';
export type {
  AccumulatedPerGameParams,
  SideScoringConfig,
} from './accumulated_per_game';

// ============================================================================
// Tested Preset registration
// ============================================================================

import { linearAboveThreshold as _linear } from './linear_above_threshold';
import { accumulateWithMilestoneJumps as _milestone } from './accumulate_with_milestone_jumps';
import { accumulatedPerGame as _perGame } from './accumulated_per_game';

/**
 * Register the three Tested Preset calculators. Idempotent — safe to call
 * multiple times.
 *
 * Also called automatically as a module-load side effect below so the
 * runtime registry is populated as soon as anything imports from this
 * file. Tests that need a clean slate call `clearRegistry()` then
 * `registerTestedPresetCalculators()` themselves.
 */
export function registerTestedPresetCalculators(): void {
  for (const calc of [_linear, _milestone, _perGame]) {
    if (!registry.has(calc.name)) {
      registry.set(calc.name, calc as PointsCalculator<unknown>);
    }
  }
}

// Self-register at module load so the runtime registry is populated
// the first time anything imports `getCalculator` / `lookupCalculator`.
// Without this, production callers (e.g. updateMatchRunningTotals,
// the per-game scoring writer) hit an empty registry and silently
// return zero points — the bug surfaced in the user's first match
// completion 2026-05-02 (no points written despite games scored).
registerTestedPresetCalculators();
