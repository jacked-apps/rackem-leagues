/**
 * @fileoverview Team Geometry factory + public exports.
 *
 * `getTeamGeometry(lineupSize, maxRosterSize, gameGeneration)` is the runtime entry point
 * for creating a Team Geometry Module from a league's configured axes. The resolver
 * (`buildSystemFromPreferences`) calls this when assembling the SystemModule for a league.
 *
 * Phase A of Unit 1 (per `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`):
 * create the Module in isolation, no consumer changes. Phase B wires it into the SystemModule
 * interface and the 3 prepackaged systems. Phase C swaps consumers from the legacy
 * `teamFormat` field + `getMatchTotalGames` utility to use the Module's properties directly.
 *
 * @see ./types.ts — the type definitions
 * @see docs/league-system/modules/team-geometry.md — the locked blueprint
 */

import type { GameGeneration, TeamGeometry } from './types';

/**
 * Derive the total games per match-night from lineup_size + game_generation.
 *
 * Formula: `lineup_size² × multiplier(game_generation)`.
 * Multiplier: `double_round_robin` = 2, anything else = 1 (graceful fallback for
 * unknown game-generation values that may arrive from un-typed sources like DB rows
 * with stale data).
 *
 * Exposed as a standalone function (in addition to being computed by `getTeamGeometry`)
 * so that callers who only have raw axes (not a constructed Module) can derive game_count
 * without constructing one. Replaces the legacy `getMatchTotalGames` utility (deprecated
 * in this Phase C; deleted once all callers migrate).
 *
 * Accepts `gameGeneration: string` rather than the strict `GameGeneration` enum to
 * preserve the legacy utility's permissive behavior — callers that pass an unrecognized
 * value still get a sensible single-round-robin fallback rather than NaN or a throw.
 *
 * @example
 *   computeGameCount(3, 'double_round_robin') // 18
 *   computeGameCount(5, 'single_round_robin') // 25
 *   computeGameCount(4, 'double_round_robin') // 32
 *   computeGameCount(5, 'experimental')       // 25 (falls back to single-round-robin multiplier)
 */
export function computeGameCount(
  lineupSize: number,
  gameGeneration: GameGeneration | string,
): number {
  const multiplier = gameGeneration === 'double_round_robin' ? 2 : 1;
  return lineupSize * lineupSize * multiplier;
}

/**
 * Create a Team Geometry Module from validated axis values.
 *
 * Inputs are assumed to be pre-validated at preference-write time (DB CHECK constraints
 * + application-layer validation enforce the legal ranges). The factory doesn't re-validate;
 * it constructs the Module and computes the derived `gameCount`.
 *
 * @param lineupSize Players per team on a match night (positive integer).
 * @param maxRosterSize Administrative roster cap (positive integer ≥ lineupSize).
 * @param gameGeneration How match-night games arise from the lineup cross-product.
 * @returns A `TeamGeometry` Module with the three axes + derived `gameCount`.
 */
export function getTeamGeometry(
  lineupSize: number,
  maxRosterSize: number,
  gameGeneration: GameGeneration,
): TeamGeometry {
  return {
    lineupSize,
    maxRosterSize,
    gameGeneration,
    gameCount: computeGameCount(lineupSize, gameGeneration),
  };
}

// Re-exports for convenience: `import { ... } from '@/systems/team-geometry'`.
export type { GameGeneration, TeamGeometry } from './types';
