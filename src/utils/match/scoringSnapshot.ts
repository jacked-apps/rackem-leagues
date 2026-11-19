/**
 * @fileoverview Read a match's frozen scoring settings off its row: the
 * points calculator, win condition and per-game allocator from
 * `system_snapshot`, and the per-side thresholds from the `*_to_win/tie/lose`
 * columns. Pure — no database access.
 *
 * Split out of `updateMatchRunningTotals` (src/api/queries/matches.ts) on
 * 2026-11-17 (trustworthy-tests U2) so production and the season replay test
 * read a match row the same way.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U2)
 */

import type { PerGameAllocator } from '@/systems/points-system/types';
import type { HandicapThresholds } from '@/types/match';

/** The scoring settings a match was frozen with. */
export interface ScoringSettings {
  pointsCalculator: string | null;
  pointsCalculatorParams: Record<string, unknown>;
  winCondition: 'games' | 'points';
  /** Per-Game Allocator Room override; null for snapshots written before it existed. */
  perGameAllocatorOverride: PerGameAllocator | null;
}

/** The threshold columns as they sit on a `matches` row. */
export interface MatchThresholdColumns {
  home_to_win: number | null;
  home_to_tie: number | null;
  home_to_lose: number | null;
  away_to_win: number | null;
  away_to_tie: number | null;
  away_to_lose: number | null;
}

/**
 * Settings from a match's `system_snapshot`, or `null` when the snapshot is
 * missing or predates `points_calculator` — the caller then falls back to the
 * league's live preferences (production) or fails loudly (the replay).
 *
 * @param snapshot - the raw `matches.system_snapshot` JSON
 * @returns the frozen settings, or null if the snapshot can't supply them
 * @example readScoringSnapshot({ points_calculator: 'bca3v3', points_calculator_params: {} })
 * // → { pointsCalculator: 'bca3v3', pointsCalculatorParams: {}, winCondition: 'games', perGameAllocatorOverride: null }
 */
export function readScoringSnapshot(snapshot: unknown): ScoringSettings | null {
  if (!snapshot || typeof snapshot !== 'object' || !('points_calculator' in snapshot)) return null;
  const snap = snapshot as {
    points_calculator: string | null;
    points_calculator_params?: Record<string, unknown> | null;
    win_condition?: 'games' | 'points';
    per_game_allocator?: PerGameAllocator | null;
  };
  return {
    pointsCalculator: snap.points_calculator ?? null,
    pointsCalculatorParams: snap.points_calculator_params ?? {},
    winCondition: snap.win_condition ?? 'games',
    // The snapshot writer already validated the allocator via the loader, so
    // it's read as-is.
    perGameAllocatorOverride: snap.per_game_allocator ?? null,
  };
}

/**
 * The per-side thresholds the engine and legacy paths both take.
 *
 * @param row - a `matches` row with the six threshold columns
 */
export function thresholdsFromMatchRow(row: MatchThresholdColumns): {
  homeThresholds: HandicapThresholds;
  awayThresholds: HandicapThresholds;
} {
  return {
    homeThresholds: {
      games_to_win: row.home_to_win,
      games_to_tie: row.home_to_tie,
      games_to_lose: row.home_to_lose,
    },
    awayThresholds: {
      games_to_win: row.away_to_win,
      games_to_tie: row.away_to_tie,
      games_to_lose: row.away_to_lose,
    },
  };
}
