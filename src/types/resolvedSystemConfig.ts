/**
 * @fileoverview ResolvedSystemConfig — full per-match system snapshot.
 *
 * The shape that `match.system_snapshot` JSONB will hold once the snapshot
 * population is expanded to capture all 13 modular axes. Today the snapshot
 * stores a smaller shape ({ overrides, threshold_chart_id, snapshot_at });
 * Phase 5 work expands the writer to capture this full type so the scoring
 * runtime can reconstruct a SystemModule via `buildSystemFromPreferences`
 * without re-querying the (potentially-edited) league preferences.
 *
 * This file defines the TYPE in isolation; the snapshot population code
 * change is deferred to Phase 5 where the runtime resolver consumes the
 * snapshot. Defining the type now means the resolved view and the audit
 * table can reference the structure consistently.
 *
 * Compatibility: snapshot consumers are required to tolerate UNKNOWN keys
 * (forward compatibility — newer schema may add fields) and MISSING keys
 * (older snapshots predate fields — fall back to module defaults with a
 * console warning). The shape below is the canonical "current" version
 * but JSONB doesn't enforce it.
 */

import type { SystemOverrides } from './systemOverrides';

/**
 * Standings sort priority — subset of these keys, in priority order.
 * Mirrors the DB CHECK constraint on preferences.standings_sort.
 */
export type StandingsSortKey = 'match_wins' | 'games_won' | 'points_earned';

/**
 * Full resolved per-match system configuration.
 *
 * Captured at match-start (scheduled → in_progress transition, post Phase 5)
 * so the scoring runtime never needs to re-resolve preferences mid-match.
 * Any league-preference edits that happen AFTER the snapshot is written
 * are invisible to in-flight matches — protecting in-flight match data
 * from retroactive scoring changes.
 *
 * Maps 1:1 to the modular preference axes (R1–R13 in the plan):
 *   R1  lineup_size
 *   R2  max_roster_size
 *   R3  game_generation
 *   R4  pairing_format + race_length
 *   R5  scoring_method
 *   R6  win_condition
 *   R7  handicap_type
 *   R8  mechanism
 *   R9  threshold_chart_id (Layer 3 source) + system_overrides (Layer 2 dials)
 *   R10 standings_sort
 *   R11 tiebreaker_trigger + tiebreaker_format
 *   R13 backfilled_at_migration flag
 */
export interface ResolvedSystemConfig {
  /** Per-axis modular preference values, all resolved to non-null. */
  lineup_size: number;
  max_roster_size: number;
  game_generation: 'single_round_robin' | 'double_round_robin' | string;
  pairing_format: 'single_rack' | 'race_to_n';
  race_length: number | null;
  scoring_method: 'winner_takes_all' | 'points_10_7' | 'race_winner';
  win_condition:
    | 'first_to_games'
    | 'first_to_pairings'
    | 'highest_after_all_games'
    | 'total_points_target';
  handicap_type: string;
  mechanism: 'extra_games' | 'start_points' | 'race_length_adjustment' | 'none';
  threshold_chart_id: string | null;
  standings_sort: StandingsSortKey[];
  tiebreaker_trigger: 'even_total_games_only' | 'never';
  tiebreaker_format: 'best_of_3_short_race' | 'single_short_race' | 'accept_tie';

  /** League-level dials merged from leagues.system_overrides. */
  overrides: SystemOverrides;

  /** ISO-8601 timestamp when this snapshot was written. */
  snapshot_at: string;

  /**
   * True when this snapshot was written by the one-time migration that
   * backfills in-flight matches at deploy time, NOT by the live trigger
   * at scheduled→in_progress. UI surfaces a warning banner so the LO
   * knows the snapshot is a best-available approximation rather than
   * the actual config used during play.
   */
  backfilled_at_migration?: boolean;
}

/**
 * Type guard: narrow `unknown` from a JSONB read into ResolvedSystemConfig
 * shape, with permissive partial support for forward/backward compatibility.
 *
 * Returns true when the snapshot is "well-formed enough" — has the
 * structural fields the scoring runtime needs. Missing optional fields
 * trigger console warnings at the use site, not parse failures.
 */
export function isResolvedSystemConfigShape(
  value: unknown
): value is Partial<ResolvedSystemConfig> {
  if (typeof value !== 'object' || value === null) return false;
  // Minimum: must have snapshot_at (ISO string) for any structured use.
  // Other fields are optional during the migration window when older
  // snapshots predate the expansion.
  const v = value as Record<string, unknown>;
  return typeof v.snapshot_at === 'string';
}
