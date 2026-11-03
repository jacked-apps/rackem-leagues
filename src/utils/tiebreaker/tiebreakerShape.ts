/**
 * @fileoverview The single home for "what does this tiebreaker format look
 * like in numbers" — Unit 2 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * League preferences only carry the `tiebreaker_format` enum. The tiebreak
 * record (match_tiebreakers) needs real numbers — wins needed, games laid out,
 * players credited — and FREEZES them at creation, so everything downstream
 * reads the record instead of switching on the format again.
 */

/** The numbers frozen onto a match_tiebreakers row at creation. */
export interface TiebreakerShape {
  /** Wins required to take the tiebreaker. */
  gamesNeeded: number;
  /** Games the tiebreaker lays out (the last may never be played). */
  gameCount: number;
  /** Players per side who take part — and, on the winning side, get credited. */
  playersPerSide: number;
}

const BEST_OF_3: TiebreakerShape = { gamesNeeded: 2, gameCount: 3, playersPerSide: 3 };

/**
 * Map a resolved `tiebreaker_format` to its shape.
 *
 * - `best_of_3_short_race` → first to 2 of 3, three players a side.
 * - `single_short_race`    → one game, one player a side.
 * - `accept_tie`           → best-of-3. Not a real choice: it was an accidental
 *   default (migration 20261028204853) and the wizard no longer offers it, but
 *   frozen match snapshots can still carry it. Best-of-3 is exactly what those
 *   matches get today. Do NOT turn this into a "no tiebreaker" path.
 * - `manual`               → null. The LO enters the result on paper
 *   (ManualTiebreakerDialog); no record is created. Out of scope (Ed).
 * - anything unknown       → best-of-3, the default.
 *
 * @param format - `system_snapshot.tiebreaker_format` (or resolved preference)
 * @returns The shape to freeze on the record, or null when no record is made
 *
 * @example
 * getTiebreakerShape('best_of_3_short_race') // { gamesNeeded: 2, gameCount: 3, playersPerSide: 3 }
 * getTiebreakerShape('manual')               // null
 */
export function getTiebreakerShape(format: string | null | undefined): TiebreakerShape | null {
  switch (format) {
    case 'manual':
      return null;
    case 'single_short_race':
      return { gamesNeeded: 1, gameCount: 1, playersPerSide: 1 };
    case 'best_of_3_short_race':
    case 'accept_tie':
    default:
      return BEST_OF_3;
  }
}
