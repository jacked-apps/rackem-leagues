/**
 * @fileoverview Read a player's handicap as it was on the night of a match.
 *
 * `match_lineups` stores each slot's player id NEXT TO that player's handicap,
 * frozen when the lineup was set. That pairing is the whole point: a player who
 * was a 2 last season and is a 4 now must still count as a 2 in the games they
 * played as one. Reading their current handicap from `members` instead would
 * silently rewrite every past game each time a rating changed — a wrong answer
 * that never announces itself.
 *
 * Matched by PLAYER ID, never by lineup position. `match_games` does carry
 * `home_position` / `away_position`, and mapping those to `player{N}_handicap`
 * would work — right up until an off-by-one, which would attribute the wrong
 * handicap to every opponent on the page while erroring nowhere. Matching on
 * the id the row already gives us cannot drift.
 *
 * @see docs/plans/2026-09-06-001-feat-my-stats-page-plan.md (Unit 1)
 */

/**
 * The lineup fields this reads. A structural subset of `match_lineups` so
 * callers can pass a narrowed query result without casting.
 */
export interface LineupHandicaps {
  player1_id: string | null;
  player1_handicap: number | null;
  player2_id: string | null;
  player2_handicap: number | null;
  player3_id: string | null;
  player3_handicap: number | null;
  player4_id: string | null;
  player4_handicap: number | null;
  player5_id: string | null;
  player5_handicap: number | null;
  /** A substitute swapped in for this match. Subs hold a slot like anyone else. */
  swap_new_player_id: string | null;
  swap_new_player_handicap: number | null;
}

/**
 * The handicap this player carried in this lineup.
 *
 * @param lineup - The `match_lineups` row for the player's team that match.
 *                 Null when the match has no recorded lineup.
 * @param playerId - The member whose handicap is wanted.
 * @returns Their handicap that night, or null when the lineup does not name
 *          them, when it names them with no handicap recorded, or when there is
 *          no lineup at all. Null means "not known", never "zero" — a zero
 *          handicap is a real and different thing.
 *
 * @example
 * handicapForPlayer(lineup, 'member-abc'); // 2 — what they were that night
 */
export function handicapForPlayer(
  lineup: LineupHandicaps | null | undefined,
  playerId: string | null | undefined
): number | null {
  if (!lineup || !playerId) return null;

  const slots: [string | null, number | null][] = [
    [lineup.player1_id, lineup.player1_handicap],
    [lineup.player2_id, lineup.player2_handicap],
    [lineup.player3_id, lineup.player3_handicap],
    [lineup.player4_id, lineup.player4_handicap],
    [lineup.player5_id, lineup.player5_handicap],
    // Checked last so that a substitute who also appears in a numbered slot
    // resolves to the slot they actually played, not the swap record.
    [lineup.swap_new_player_id, lineup.swap_new_player_handicap],
  ];

  for (const [id, handicap] of slots) {
    if (id && id === playerId) return handicap ?? null;
  }
  return null;
}
