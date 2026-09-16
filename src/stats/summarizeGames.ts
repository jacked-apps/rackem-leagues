/**
 * @fileoverview Turn rows into the numbers the page shows.
 *
 * Pure — no React, no fetching. Runs over whatever rows it is handed, which is
 * what lets a filter recompute the whole summary instead of merely hiding table
 * rows. "My record on table 2" has to change the counts, or it isn't a record.
 *
 * The both-directions breakdown is the reason the feature exists. A win-loss
 * line cannot tell two players apart; how they lost can. Two players at 100-100
 * are not alike if one lost fifty games to opponents running out on them and
 * the other lost fifty they were still in.
 *
 * @see docs/plans/2026-09-06-001-feat-my-stats-page-plan.md (Unit 2)
 */

import type { GameEnding, PlayerGameRow } from './playerGameRow';

/**
 * How often one ending appeared, split by which side of it the player was on.
 *
 * Both halves come from the same rows — a game ending in a break & run is a
 * `won` for one player and a `lost` for the other, and the row already knows
 * which. This split IS the feature.
 */
export interface EndingBreakdown {
  ending: GameEnding;
  /** Games the player won that ended this way. */
  won: number;
  /** Games the player lost that ended this way. */
  lost: number;
}

/** Everything the summary block shows. */
export interface GameSummary {
  played: number;
  won: number;
  lost: number;
  /**
   * Fraction 0–1, or null when nothing has been played. Null rather than 0 so
   * the page can say "no games yet" instead of showing a 0% record to someone
   * who has never played.
   */
  winRate: number | null;
  /** One entry per ending that actually occurred, most frequent first. */
  endings: EndingBreakdown[];
  teamsPlayedOn: number;
  opponentsFaced: number;
  venuesPlayed: number;
}

/**
 * Order used when two endings occurred equally often, so the page is stable
 * between renders rather than reordering on a tie.
 */
const ENDING_ORDER: GameEnding[] = [
  'break_and_run',
  'golden_break',
  'runout',
  'early_eight',
  'forfeit',
  'plain',
];

/**
 * Summarise a set of games.
 *
 * @param rows - The games to count. Already filtered by the caller; this
 *               function has no opinion about which games belong.
 * @returns The summary. Safe on an empty array — every count is 0 and
 *          `winRate` is null.
 *
 * @example
 * const summary = summarizeGames(rows.filter(r => r.tableNumber === 2));
 * // summary.won is the record ON TABLE 2, not the overall record.
 */
export function summarizeGames(rows: PlayerGameRow[]): GameSummary {
  const counts = new Map<GameEnding, { won: number; lost: number }>();
  const teams = new Set<string>();
  const opponents = new Set<string>();
  const venues = new Set<string>();

  let won = 0;

  for (const row of rows) {
    if (row.won) won++;

    const tally = counts.get(row.ending) ?? { won: 0, lost: 0 };
    if (row.won) tally.won++;
    else tally.lost++;
    counts.set(row.ending, tally);

    if (row.myTeamId) teams.add(row.myTeamId);
    if (row.opponentId) opponents.add(row.opponentId);
    if (row.venueName) venues.add(row.venueName);
  }

  const played = rows.length;

  const endings: EndingBreakdown[] = [...counts.entries()]
    .map(([ending, tally]) => ({ ending, won: tally.won, lost: tally.lost }))
    .sort((a, b) => {
      const byTotal = b.won + b.lost - (a.won + a.lost);
      if (byTotal !== 0) return byTotal;
      return ENDING_ORDER.indexOf(a.ending) - ENDING_ORDER.indexOf(b.ending);
    });

  return {
    played,
    won,
    // Derived rather than counted separately: a game is won or it isn't, and
    // two independent counters could drift apart.
    lost: played - won,
    winRate: played === 0 ? null : won / played,
    endings,
    teamsPlayedOn: teams.size,
    opponentsFaced: opponents.size,
    venuesPlayed: venues.size,
  };
}

/**
 * Split rows into the most recent block and the block before it.
 *
 * Rows arrive newest-first, so this is two slices rather than a sort.
 *
 * @param rows - Newest-first games.
 * @param size - How many games each block holds.
 * @returns `recent` and `previous`. `previous` is empty when there is not a
 *          full earlier block — a comparison against eight games would look
 *          like a trend and mean nothing, so the page shows nothing instead.
 */
export function splitForComparison(
  rows: PlayerGameRow[],
  size: number
): { recent: PlayerGameRow[]; previous: PlayerGameRow[] } {
  if (size <= 0) return { recent: [], previous: [] };
  const recent = rows.slice(0, size);
  const previous = rows.length >= size * 2 ? rows.slice(size, size * 2) : [];
  return { recent, previous };
}
