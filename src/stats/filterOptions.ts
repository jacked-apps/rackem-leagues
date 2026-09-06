/**
 * @fileoverview What each filter can offer, given everything else that is set.
 *
 * Options come from the player's own games, so they are never offered a venue
 * they have not played. Crucially the counts are computed against the rows
 * surviving every OTHER filter — not the whole history.
 *
 * That distinction is the difference between a useful control and a lying one.
 * Counting against the full history showed "Billy (22)" while Fargo was
 * selected, and clicking it produced nothing, because none of Billy's 22 games
 * were Fargo ones. A count that does not predict its own result is worse than
 * no count.
 *
 * Each control ignores ITS OWN dimension when counting, which is what keeps a
 * narrowing reversible: the option you have chosen is always still listed, so
 * you can always change or clear it from the control itself.
 *
 * @see src/stats/gameFilters.ts
 */

import { applyGameFilter, NO_FILTER, type GameFilter } from './gameFilters';
import type { PlayerGameRow } from './playerGameRow';

/** One choice in a filter control. */
export interface FilterOption<T> {
  value: T;
  label: string;
  /** Games this option would leave, given the other filters currently set. */
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
  tableSizes: FilterOption<string>[];
}

/** Readable names for the game types actually stored. */
const GAME_TYPE_LABELS: Record<string, string> = {
  eight_ball: '8-ball',
  nine_ball: '9-ball',
  ten_ball: '10-ball',
};

/**
 * Readable names for table sizes, with the dimension spelled out.
 *
 * "Bar box" is what players say; the footage is what settles an argument about
 * which one someone means.
 */
const TABLE_SIZE_LABELS: Record<string, string> = {
  bar_box: 'Bar box (7ft)',
  eight_foot: '8ft',
  regulation: 'Regulation (9ft)',
};

/** Readable names for handicap systems. */
const SYSTEM_LABELS: Record<string, string> = {
  points: 'Points (−2 to +2)',
  percentage: 'Percentage',
  fargo: 'Fargo',
  none: 'No handicap',
};

/**
 * How many distinct values a dimension has across the WHOLE history.
 *
 * Decides whether a control is worth showing at all, which is a different
 * question from what it should currently offer. A control that can never
 * present a choice — one venue, one game type — is clutter. A control narrowed
 * to one option BY the other filters must still be shown, or the bar reshuffles
 * as you use it and controls appear to break.
 */
function distinctCount<T>(
  rows: PlayerGameRow[],
  pick: (row: PlayerGameRow) => T | null | undefined
): number {
  const seen = new Set<T>();
  for (const row of rows) {
    const value = pick(row);
    if (value !== null && value !== undefined) seen.add(value);
  }
  return seen.size;
}

/** Count values, then turn them into sorted options. */
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

/** Ascending — handicaps and table numbers read as a scale. */
function byValue(a: FilterOption<number>, b: FilterOption<number>): number {
  return a.value - b.value;
}

/**
 * Keep the chosen option visible even when nothing matches it any more.
 *
 * Selecting Fargo and then an opponent with no Fargo games would otherwise drop
 * that opponent out of their own control — leaving it showing a blank with no
 * way to see or undo the choice. Listing it as "(0)" says plainly why the page
 * is empty.
 */
function withSelected<T>(
  options: FilterOption<T>[],
  selected: T | null,
  label: (value: T) => string
): FilterOption<T>[] {
  if (selected === null) return options;
  if (options.some((o) => o.value === selected)) return options;
  return [...options, { value: selected, label: label(selected), count: 0 }];
}

/**
 * Build the filter options for a player's history.
 *
 * @param rows - The player's full, unfiltered history.
 * @param filter - What is currently selected. Each control's options are
 *                 counted with its own dimension ignored, so its counts predict
 *                 what picking that option would actually give.
 * @returns Options per control, each with an honest count.
 */
export function buildFilterOptions(
  rows: PlayerGameRow[],
  filter: GameFilter = NO_FILTER
): FilterOptions {
  const names = new Map<string, string>();
  for (const row of rows) {
    if (row.opponentId) names.set(row.opponentId, row.opponentName);
  }
  const opponentLabel = (id: string) => names.get(id) ?? 'Unknown player';
  const gameTypeLabel = (v: string) => GAME_TYPE_LABELS[v] ?? v;
  const systemLabel = (v: string) => SYSTEM_LABELS[v] ?? v;
  const tableLabel = (v: number) => `Table ${v}`;
  const sizeLabel = (v: string) => TABLE_SIZE_LABELS[v] ?? v;

  /** Rows surviving every filter EXCEPT the named dimension(s). */
  const without = (...dimensions: (keyof GameFilter)[]) => {
    const relaxed = { ...filter };
    for (const dimension of dimensions) relaxed[dimension] = null as never;
    return applyGameFilter(rows, relaxed);
  };

  /** A dimension with one value across all of history can never be a filter. */
  const useless = (pick: (row: PlayerGameRow) => unknown) =>
    distinctCount(rows, pick as (r: PlayerGameRow) => unknown) < 2;

  return {
    gameTypes: useless((r) => r.gameType) ? [] : withSelected(
      optionsFrom(without('gameType'), (r) => r.gameType, gameTypeLabel, byCountThenLabel),
      filter.gameType,
      gameTypeLabel
    ),
    handicapSystems: useless((r) => r.handicapSystem) ? [] : withSelected(
      optionsFrom(
        without('handicapSystem'),
        (r) => r.handicapSystem,
        systemLabel,
        byCountThenLabel
      ),
      filter.handicapSystem,
      systemLabel
    ),
    opponents: useless((r) => r.opponentId) ? [] : withSelected(
      optionsFrom(without('opponentId'), (r) => r.opponentId, opponentLabel, byCountThenLabel),
      filter.opponentId,
      opponentLabel
    ),
    // Both ends relax together: the band is one control in two halves, and
    // counting "from" against the current "to" would hide half the scale.
    handicaps: useless((r) => r.opponentHandicap) ? [] : optionsFrom(
      without('opponentHandicapMin', 'opponentHandicapMax'),
      (r) => r.opponentHandicap,
      String,
      byValue
    ),
    venues: useless((r) => r.venueName) ? [] : withSelected(
      optionsFrom(without('venueName'), (r) => r.venueName, (v) => v, byCountThenLabel),
      filter.venueName,
      (v) => v
    ),
    tables: useless((r) => r.tableNumber) ? [] : withSelected(
      optionsFrom(without('tableNumber'), (r) => r.tableNumber, tableLabel, byValue),
      filter.tableNumber,
      tableLabel
    ),
    tableSizes: useless((r) => r.tableSize) ? [] : withSelected(
      optionsFrom(without('tableSize'), (r) => r.tableSize, sizeLabel, byCountThenLabel),
      filter.tableSize,
      sizeLabel
    ),
  };
}
