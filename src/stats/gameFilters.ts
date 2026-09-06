/**
 * @fileoverview Narrowing a player's history.
 *
 * Pure. The page applies these to get a subset, then summarises THAT subset —
 * so "my record on table 2" recounts rather than merely hiding rows. Every
 * filter is `null` for "All", which is what makes the controls read
 * "Table: All" until someone chooses.
 *
 * Game type deserves a mention: filtering to 9-ball is what makes a generic
 * ending label unambiguous. "Golden break" spans every game, but the golden
 * breaks in a 9-ball-only view are all 9s on the break.
 *
 * @see docs/plans/2026-09-06-001-feat-my-stats-page-plan.md (Unit 4)
 */

import type { PlayerGameRow } from './playerGameRow';

/**
 * What the player has narrowed to. `null` everywhere means "everything".
 *
 * Filters combine with AND: fargo + 9-ball shows fargo matches of 9-ball, which
 * is how Ed described using them.
 */
export interface GameFilter {
  /** 'eight_ball' | 'nine_ball' | 'ten_ball' */
  gameType: string | null;
  /** 'points' | 'percentage' | 'fargo' — which handicap system the match used. */
  handicapSystem: string | null;
  /** Head-to-head: only games against this opponent. */
  opponentId: string | null;
  /**
   * Opponent handicap band, inclusive. Both null means any.
   *
   * A band rather than a single value because "50% and over" is a real question
   * under the percentage system, and "against 2s" is just a band whose ends are
   * equal. One shape serves both.
   */
  opponentHandicapMin: number | null;
  opponentHandicapMax: number | null;
  venueName: string | null;
  tableNumber: number | null;
  seasonId: string | null;
}

/** Everything — the starting state, and what each control resets to. */
export const NO_FILTER: GameFilter = {
  gameType: null,
  handicapSystem: null,
  opponentId: null,
  opponentHandicapMin: null,
  opponentHandicapMax: null,
  venueName: null,
  tableNumber: null,
  seasonId: null,
};

/** True when nothing is narrowed, so the page can say so. */
export function isUnfiltered(filter: GameFilter): boolean {
  return (Object.keys(NO_FILTER) as (keyof GameFilter)[]).every(
    (key) => filter[key] === null
  );
}

/** How many controls are currently narrowing, for a "3 filters" hint. */
export function activeFilterCount(filter: GameFilter): number {
  const handicapActive =
    filter.opponentHandicapMin !== null || filter.opponentHandicapMax !== null;
  const others: (keyof GameFilter)[] = [
    'gameType',
    'handicapSystem',
    'opponentId',
    'venueName',
    'tableNumber',
    'seasonId',
  ];
  return others.filter((key) => filter[key] !== null).length + (handicapActive ? 1 : 0);
}

/** Whether one row survives the handicap band. */
function withinHandicapBand(row: PlayerGameRow, filter: GameFilter): boolean {
  const { opponentHandicapMin: min, opponentHandicapMax: max } = filter;
  if (min === null && max === null) return true;
  // A game with no recorded handicap cannot be shown to satisfy a handicap
  // question. Including it would inflate a record "against 2s" with games whose
  // opponent might have been anything.
  if (row.opponentHandicap === null) return false;
  if (min !== null && row.opponentHandicap < min) return false;
  if (max !== null && row.opponentHandicap > max) return false;
  return true;
}

/**
 * Apply a filter to a player's games.
 *
 * @param rows - The full history (or any subset).
 * @param filter - What to narrow to; `null` fields do not narrow.
 * @returns Matching rows, in the order given.
 *
 * @example
 * // "My record against Fargo opponents rated 600+, playing 9-ball"
 * applyGameFilter(rows, {
 *   ...NO_FILTER,
 *   handicapSystem: 'fargo',
 *   gameType: 'nine_ball',
 *   opponentHandicapMin: 600,
 * });
 */
export function applyGameFilter(
  rows: PlayerGameRow[],
  filter: GameFilter
): PlayerGameRow[] {
  return rows.filter((row) => {
    if (filter.gameType !== null && row.gameType !== filter.gameType) return false;
    if (filter.handicapSystem !== null && row.handicapSystem !== filter.handicapSystem) {
      return false;
    }
    if (filter.opponentId !== null && row.opponentId !== filter.opponentId) return false;
    if (filter.venueName !== null && row.venueName !== filter.venueName) return false;
    if (filter.tableNumber !== null && row.tableNumber !== filter.tableNumber) return false;
    if (filter.seasonId !== null && row.seasonId !== filter.seasonId) return false;
    return withinHandicapBand(row, filter);
  });
}
