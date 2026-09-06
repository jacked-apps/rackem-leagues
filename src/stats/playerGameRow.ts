/**
 * @fileoverview The shape every stats surface works on: one row per rack.
 *
 * Deliberately flat. Summary maths, filters and the log all read these rows and
 * nothing else — no Supabase types, no nested match objects. That is what lets
 * the data source underneath change (see `gameHistorySource`) without anything
 * above it noticing.
 *
 * @see docs/plans/2026-09-06-001-feat-my-stats-page-plan.md
 */

/**
 * How a rack ended.
 *
 * Describes the GAME, not either player — the row already says who won, so the
 * same value reads from both chairs ("won with a break & run" / "lost to a
 * break & run"). That symmetry is the point of the stats page.
 *
 * `plain` means it ended the ordinary way, which is most of them.
 */
export type GameEnding =
  | 'break_and_run'
  | 'golden_break'
  | 'runout'
  | 'early_eight'
  | 'forfeit'
  | 'plain';

/** One rack, from one player's point of view. */
export interface PlayerGameRow {
  gameId: string;
  matchId: string;
  gameNumber: number;
  /** ISO date of the match night. Null if the week has no scheduled date. */
  playedOn: string | null;
  seasonId: string | null;
  /** Whether THIS player won. The row is always from their side. */
  won: boolean;
  ending: GameEnding;

  opponentId: string | null;
  opponentName: string;
  /**
   * The opponent's handicap ON THE NIGHT, never their current one.
   * Null = not recorded. Distinct from 0, which is a real handicap.
   */
  opponentHandicap: number | null;
  /**
   * Which handicap system that match was played under (`points`, `percentage`,
   * `fargo`, …). Read, never inferred from the number's magnitude — the ranges
   * overlap plausibly enough that a guess would be wrong silently, and a fourth
   * system would break any such rule retroactively.
   */
  handicapSystem: string | null;

  venueName: string | null;
  /** Table number for the match. Per night, not per rack. */
  tableNumber: number | null;
  /** The team this player was on that night. */
  myTeamId: string | null;
}
