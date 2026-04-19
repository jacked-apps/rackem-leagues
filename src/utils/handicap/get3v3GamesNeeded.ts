/**
 * @fileoverview 3v3 Handicap Chart Lookup (Hard-coded)
 *
 * Static lookup table for 3v3 (5-man league) handicap thresholds.
 * Based on Custom 5-Man Double Round Robin Handicap System.
 * 18 total games per match (double round-robin).
 *
 * Source: CUSTOM_5MAN_HANDICAP_SYSTEM.md
 */

export interface HandicapThresholds {
  games_to_win: number;
  games_to_tie: number | null;
  // Fargo matches set this to null — Fargo scores by point accumulation, not
  // by a games-to-lose threshold. BCA systems (points, percentage) always
  // return a non-null number.
  games_to_lose: number | null;
}

/**
 * Static handicap chart for 3v3 matches
 * Range: -12 to +12 handicap difference
 *
 * Key insights:
 * - Ties only possible at even handicap levels (0, ±2, ±4, etc.)
 * - Higher handicap = more games needed to win
 * - Lower handicap = fewer games needed to win
 */
const HANDICAP_CHART_3V3: Record<number, HandicapThresholds> = {
  12: { games_to_win: 16, games_to_tie: 15, games_to_lose: 14 },
  11: { games_to_win: 15, games_to_tie: null, games_to_lose: 14 },
  10: { games_to_win: 15, games_to_tie: 14, games_to_lose: 13 },
  9: { games_to_win: 14, games_to_tie: null, games_to_lose: 13 },
  8: { games_to_win: 14, games_to_tie: 13, games_to_lose: 12 },
  7: { games_to_win: 13, games_to_tie: null, games_to_lose: 12 },
  6: { games_to_win: 13, games_to_tie: 12, games_to_lose: 11 },
  5: { games_to_win: 12, games_to_tie: null, games_to_lose: 11 },
  4: { games_to_win: 12, games_to_tie: 11, games_to_lose: 10 },
  3: { games_to_win: 11, games_to_tie: null, games_to_lose: 10 },
  2: { games_to_win: 11, games_to_tie: 10, games_to_lose: 9 },
  1: { games_to_win: 10, games_to_tie: null, games_to_lose: 9 },
  0: { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 },
  '-1': { games_to_win: 9, games_to_tie: null, games_to_lose: 8 },
  '-2': { games_to_win: 9, games_to_tie: 8, games_to_lose: 7 },
  '-3': { games_to_win: 8, games_to_tie: null, games_to_lose: 7 },
  '-4': { games_to_win: 8, games_to_tie: 7, games_to_lose: 6 },
  '-5': { games_to_win: 7, games_to_tie: null, games_to_lose: 6 },
  '-6': { games_to_win: 7, games_to_tie: 6, games_to_lose: 5 },
  '-7': { games_to_win: 6, games_to_tie: null, games_to_lose: 5 },
  '-8': { games_to_win: 6, games_to_tie: 5, games_to_lose: 4 },
  '-9': { games_to_win: 5, games_to_tie: null, games_to_lose: 4 },
  '-10': { games_to_win: 5, games_to_tie: 4, games_to_lose: 3 },
  '-11': { games_to_win: 4, games_to_tie: null, games_to_lose: 3 },
  '-12': { games_to_win: 4, games_to_tie: 3, games_to_lose: 2 },
};

/**
 * Get games needed to win/tie/lose for 3v3 match based on handicap difference
 *
 * @param handicapDiff - Handicap difference (will be capped to ±12)
 * @returns Handicap thresholds (games_to_win, games_to_tie, games_to_lose)
 *
 * @example
 * const thresholds = get3v3GamesNeeded(5);
 * console.log(`Need ${thresholds.games_to_win} games to win`); // "Need 12 games to win"
 *
 * @example
 * // Handicap difference beyond ±12 is capped
 * const thresholds = get3v3GamesNeeded(20); // Capped to 12
 * console.log(thresholds.games_to_win); // 16
 */
export function get3v3GamesNeeded(handicapDiff: number): HandicapThresholds {
  // Cap handicap difference to ±12 range
  const cappedDiff = Math.max(-12, Math.min(12, Math.round(handicapDiff)));

  // Lookup from static chart
  const thresholds = HANDICAP_CHART_3V3[cappedDiff];

  if (!thresholds) {
    throw new Error(`Invalid handicap difference: ${cappedDiff}`);
  }

  return thresholds;
}
