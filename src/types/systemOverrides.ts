/**
 * @fileoverview System Overrides JSONB Shape
 *
 * Per-league dial overrides stored as `leagues.system_overrides JSONB`.
 * Flat key-value — each key corresponds to a documented dial in the plan
 * (docs/plans/2026-04-18-001-refactor-modular-handicap-scoring-systems-plan.md,
 * "Known Dials" section).
 *
 * Absent keys fall back to module defaults. Operators only persist values
 * that differ from defaults to keep the JSONB compact.
 *
 * Typing is strict: adding a new dial requires updating this interface.
 * No index signature — typos like `winnerPoints` (wrong case) should fail
 * at compile time rather than silently revert to defaults at runtime.
 */

/**
 * Dial overrides for a single league.
 *
 * Fargo-only dials only take effect when the league's handicap_type is 'fargo'.
 * BCA-only dials only take effect when handicap_type is 'points' or 'percentage'.
 * Each module ignores dials irrelevant to it.
 */
export interface SystemOverrides {
  // ============================================================================
  // Fargo dials
  // ============================================================================

  /** Winner points per game. Fargo default: 10. Override: e.g. 14 (USAPL) or 17 (BCAPL 17-point). */
  winner_points?: number;

  /** How loser points are computed. Fargo default: 'balls_pocketed'. */
  loser_points_method?: 'balls_pocketed' | 'fixed' | 'none';

  /** Maximum loser points per game. Fargo default: 7 (8-ball: 7 balls on table). */
  loser_points_max?: number;

  // ============================================================================
  // BCA dials
  // ============================================================================

  /** Whether team standings bonus points apply. BCA default: true. */
  team_bonus_enabled?: boolean;
}
