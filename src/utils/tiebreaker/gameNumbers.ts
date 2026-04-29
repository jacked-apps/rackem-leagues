/**
 * @fileoverview Tiebreaker game-number arithmetic.
 *
 * Phase 5 Unit 5.4 of the modular-league plan
 * (docs/plans/2026-04-28-001-feat-modular-league-system-plan.md).
 *
 * Today's BCA 3v3 match has 18 regular games + up to 3 tiebreaker games
 * numbered 19, 20, 21. Those numbers were HARDCODED in
 * MatchEndVerification.tsx — fine for the 3v3-only world, broken once
 * the LO can configure 4v4 (16 regular games → tiebreaker at 17/18/19)
 * or 5v5 DRR (50 regular games → tiebreaker at 51/52/53).
 *
 * This utility abstracts the game-number arithmetic from the lineup
 * geometry. The MatchEndVerification refactor (Unit 5.2 — separate PR)
 * reads matchTotalGames from the match's system_snapshot.
 *
 * The 18-game 3v3 case is locked by characterization tests in
 * src/utils/__tests__/gameOrder.characterization.test.ts (the
 * isTiebreakerGame predicate's "games 19-21 are tiebreakers" rule).
 * That test continues to pass when MatchEndVerification calls into
 * this helper with matchTotalGames=18.
 */

/**
 * Compute the tiebreaker game numbers for a match.
 *
 * @param matchTotalGames - Number of regular games in the match
 *                          (18 for BCA 3v3 DRR, 25 for BCA 5v5 SRR,
 *                          36 for 6v6 SRR, etc.)
 * @param count - How many tiebreaker games (default 3 for the
 *                best_of_3_short_race tiebreaker_format).
 *
 * @returns Game numbers `[matchTotalGames + 1, ..., matchTotalGames + count]`.
 *          Empty array when count <= 0 (e.g. tiebreaker_format='accept_tie').
 *
 * @example
 * // BCA 3v3 18-game match, default 3 tiebreakers:
 * tiebreakerGameNumbers(18) // [19, 20, 21]
 *
 * @example
 * // 4v4 16-game match, 3 tiebreakers:
 * tiebreakerGameNumbers(16) // [17, 18, 19]
 *
 * @example
 * // tiebreaker_format='single_short_race' (count = 1):
 * tiebreakerGameNumbers(18, 1) // [19]
 *
 * @example
 * // tiebreaker_format='accept_tie' (count = 0):
 * tiebreakerGameNumbers(18, 0) // []
 */
export function tiebreakerGameNumbers(
  matchTotalGames: number,
  count: number = 3
): number[] {
  if (count <= 0) return [];
  if (matchTotalGames < 0) {
    throw new Error(
      `tiebreakerGameNumbers: matchTotalGames must be >= 0, got ${matchTotalGames}`
    );
  }
  return Array.from({ length: count }, (_, i) => matchTotalGames + i + 1);
}

/**
 * Map a tiebreaker game number back to its zero-indexed position
 * within the tiebreaker round (game 19 → position 0, game 20 → 1, etc.).
 *
 * Used by the lineup-application loop in MatchEndVerification: each
 * tiebreaker game should use the winning team's player at the
 * corresponding lineup position. For matchTotalGames=18, the legacy
 * code computed `position = gameNumber - 18` (giving 1, 2, 3 — but
 * lineups are 1-indexed; the legacy mapping was off-by-one in name
 * only, since gameNumber-18 = 1..3 maps to player1..player3 directly).
 *
 * This helper returns ZERO-INDEXED position (0, 1, 2) — caller adds 1
 * if they need the legacy 1-indexed position.
 */
export function tiebreakerGameToPosition(
  matchTotalGames: number,
  gameNumber: number
): number {
  return gameNumber - matchTotalGames - 1;
}

/**
 * Produce the full tiebreaker game-creation specs (game_number +
 * alternating home/away action). Mirrors what MatchEndVerification
 * inserts today for BCA 3v3: home breaks game 1, racks game 2,
 * breaks game 3.
 */
export interface TiebreakerGameSpec {
  game_number: number;
  home_action: 'breaks' | 'racks';
  away_action: 'breaks' | 'racks';
}

export function tiebreakerGameSpecs(
  matchTotalGames: number,
  count: number = 3
): TiebreakerGameSpec[] {
  const numbers = tiebreakerGameNumbers(matchTotalGames, count);
  return numbers.map((game_number, index) => {
    const homeBreaks = index % 2 === 0;
    return {
      game_number,
      home_action: homeBreaks ? 'breaks' : 'racks',
      away_action: homeBreaks ? 'racks' : 'breaks',
    };
  });
}
