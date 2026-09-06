/**
 * @fileoverview What each filter can offer, derived from the player's own games.
 *
 * Options come from the data rather than from a fixed list, so a player is
 * never offered a venue they have not played or a handicap system their league
 * does not use. A control with nothing to choose from is hidden by the caller
 * instead of presenting an empty menu.
 *
 * @see src/stats/gameFilters.ts
 */

import type { PlayerGameRow } from './playerGameRow';

/** One choice in a filter control. */
export interface FilterOption<T> {
  value: T;
  label: string;
  /** How many games this option would leave, so a player can see it is worth picking. */
  count: number;
}

/** Everything the filter bar can offer for this history. */
export interface FilterOptions {
  gameTypes: FilterOption<string>[];
  handicapSystems: FilterOption<string>[];
  opponents: FilterOption<string>[];
  handicaps: FilterOption<number>[];
  venues: FilterOption<string>[];
  tables: FilterOption<number>[];
}

/** Readable names for the game types actually stored. */
const GAME_TYPE_LABELS: Record<string, string> = {
  eight_ball: '8-ball',
  nine_ball: '9-ball',
  ten_ball: '10-ball',
};

/** Readable names for handicap systems. */
const SYSTEM_LABELS: Record<string, string> = {
  points: 'Points (−2 to +2)',
  percentage: 'Percentage',
  fargo: 'Fargo',
  none: 'No handicap',
};

/**
 * Count occurrences of a key, then turn them into sorted options.
 *
 * @param rows - Games to scan.
 * @param pick - Reads the value from a row; null/undefined rows are skipped.
 * @param label - Names a value for display.
 * @param compare - Orders the finished options.
 */
function optionsFrom<T>(
  rows: PlayerGameRow[],
  pick: (row: PlayerGameRow) => T | null | undefined,
  label: (value: T) => string,
  compare: (a: FilterOption<T>, b: FilterOption<T>) => number
): FilterOption<T>[] {
  const counts = new Map<T, number>();
  for (const row of rows) {
    const value = pick(row);
    if (value === null || value === undefined) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort(compare);
}

/** Most-played first — the option someone is likeliest to want. */
function byCountThenLabel<T>(a: FilterOption<T>, b: FilterOption<T>): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

/** Ascending by value — handicaps and table numbers read as a scale. */
function byValue(a: FilterOption<number>, b: FilterOption<number>): number {
  return a.value - b.value;
}

/**
 * Build the filter options for a player's history.
 *
 * Derived from the UNFILTERED history on purpose: options that disappeared as
 * you narrowed would make it impossible to widen again from the control itself.
 *
 * @param rows - The player's full history.
 * @returns Options per control, each with a count.
 */
export function buildFilterOptions(rows: PlayerGameRow[]): FilterOptions {
  const names = new Map<string, string>();
  for (const row of rows) {
    if (row.opponentId) names.set(row.opponentId, row.opponentName);
  }

  return {
    gameTypes: optionsFrom(
      rows,
      (r) => r.gameType,
      (v) => GAME_TYPE_LABELS[v] ?? v,
      byCountThenLabel
    ),
    handicapSystems: optionsFrom(
      rows,
      (r) => r.handicapSystem,
      (v) => SYSTEM_LABELS[v] ?? v,
      byCountThenLabel
    ),
    opponents: optionsFrom(
      rows,
      (r) => r.opponentId,
      (v) => names.get(v) ?? 'Unknown player',
      byCountThenLabel
    ),
    handicaps: optionsFrom(
      rows,
      (r) => r.opponentHandicap,
      (v) => String(v),
      byValue
    ),
    venues: optionsFrom(rows, (r) => r.venueName, (v) => v, byCountThenLabel),
    tables: optionsFrom(
      rows,
      (r) => r.tableNumber,
      (v) => `Table ${v}`,
      byValue
    ),
  };
}
