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
