/**
 * @fileoverview Win Calculator factory + public exports.
 *
 * `getWinCalculator(winCondition)` is the runtime entry point for creating a Win Calculator
 * Module from a league's `win_condition` preference value. The resolver
 * (`buildSystemFromPreferences`) calls this when assembling the SystemModule for a league.
 *
 * **Unit 1 scope discipline:** every Win Calculator produced here has a one-entry metric
 * stack matching the LO's `win_condition`. Multi-entry stacks come in later units.
 *
 * @see ./types.ts — type definitions
 * @see ./walker.ts — the metric-stack walker
 * @see docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md — Unit 1
 */

import type { MetricStackEntry, WinCalculator } from './types';
import { walkMetricStack } from './walker';

/**
 * Create a Win Calculator Module from a `win_condition` preference value.
 *
 * Returns a Module with a one-entry metric stack:
 *   - `'games'` → `[{ kind: 'games_won' }]`
 *   - `'points'` → `[{ kind: 'points_earned' }]`
 *
 * The returned Module's `decide(matchData)` walks the one-entry stack via `walkMetricStack`,
 * producing the same winner that today's inline `win_condition` branching produces.
 *
 * @param winCondition The league's `win_condition` preference value ('games' or 'points').
 * @returns A `WinCalculator` Module with a one-entry stack and a `decide` function.
 */
export function getWinCalculator(winCondition: 'games' | 'points'): WinCalculator {
  const metricStack: ReadonlyArray<MetricStackEntry> =
    winCondition === 'games' ? [{ kind: 'games_won' }] : [{ kind: 'points_earned' }];

  return {
    metricStack,
    decide: (data) => walkMetricStack(metricStack, data),
  };
}

// Re-exports for convenience: `import { ... } from '@/systems/win-calculators'`.
export type {
  MatchData,
  MetricStackEntry,
  WinCalculator,
  WinnerDecision,
} from './types';
export { walkMetricStack } from './walker';
