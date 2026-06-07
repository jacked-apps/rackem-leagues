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
import type { PerGameAllocator } from '@/systems/points-system/types';

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
 * Maps 1:1 to the modular preference axes (corrected per the v2 plan's
 * architectural reframe — supplement Section 1):
 *   R1  lineup_size
 *   R2  max_roster_size
 *   R3  game_generation
 *   R4  pairing_format + race_length
 *   R5  points_calculator + points_calculator_params  (renamed from scoring_method;
 *                                                     params hold LO-editable values)
 *   R6  win_condition  (binary games | points; collapsed from 4 values)
 *   R7  handicap_type
 *   R8  mechanism
 *   R9  threshold_chart_id (Layer 3 source) + system_overrides (Layer 2 dials)
 *   R10 standings_sort
 *   R11 tiebreaker_trigger + tiebreaker_format
 *   R13 backfilled_at_migration flag
 */
export interface ResolvedSystemConfig {
  /** Per-axis modular preference values, all resolved to non-null (or NULL where the axis allows it). */
  lineup_size: number;
  max_roster_size: number;
  game_generation: 'single_round_robin' | 'double_round_robin' | string;
  pairing_format: 'single_rack' | 'race_to_n';
  race_length: number | null;

  /**
   * Calculator name (matches the registered name in src/systems/calculators/).
   * NULL means the league does not track points at all — standings sort cannot
   * include points_earned and win_condition must be 'games'.
   */
  points_calculator:
    | 'linear_above_threshold'
    | 'accumulate_with_milestone_jumps'
    | 'accumulated_per_game'
    | string
    | null;

  /**
   * Editable parameter values for the calculator. Shape varies by calculator
   * type — each calculator owns its own zod schema. Empty object means "use
   * the calculator's defaultParams" (Tested Preset values).
   */
  points_calculator_params: Record<string, unknown>;

  /** Binary: games or points decides the match. */
  win_condition: 'games' | 'points';

  handicap_type: string;
  mechanism: 'extra_games' | 'start_points' | 'race_length_adjustment' | 'none';
  threshold_chart_id: string | null;
  standings_sort: StandingsSortKey[];
  tiebreaker_trigger: 'even_total_games_only' | 'never';
  tiebreaker_format: 'best_of_3_short_race' | 'single_short_race' | 'accept_tie' | 'manual';

  /** League-level dials merged from leagues.system_overrides. */
  overrides: SystemOverrides;

  /**
   * FK pointer to a saved per-game allocator variation (Per-Game Allocator
   * Room, Unit 5). Cascades through `resolved_league_preferences` from
   * `preferences.per_game_allocator_id`. NULL means "no variation picked;
   * use the prepackaged composition's allocator slot unchanged."
   */
  per_game_allocator_id: string | null;

  /**
   * Resolved per-game allocator variation, frozen at match-start.
   *
   * Populated by the snapshot writer (`populateMatchSnapshotIfNeeded`) when
   * `per_game_allocator_id` is non-null: the writer calls the loader and
   * embeds the returned object here. Live scoring reads this field directly
   * — it does NOT re-fetch the row at per-game time, so editing the saved
   * variation after a match starts cannot retroactively change that match's
   * scoring (R9 of the room plan).
   *
   * `undefined` on resolved-from-live-prefs reads (the snapshot-write code
   * path is the only place this gets populated). `null` when the FK was
   * set but the loader failed (logged warn) — readers fall back to the
   * prepackaged allocator, identical to the no-FK behavior.
   */
  per_game_allocator?: PerGameAllocator | null;

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
