/**
 * @fileoverview Match-result determination from threshold-vs-wins comparison.
 *
 * Given home and away win counts and the (already-applied) handicap thresholds
 * for each side, returns the match result: 'home_win' | 'away_win' | 'tie'.
 *
 * Result rules (BCA games-won systems — the cascade):
 *   1. If home wins ≥ home_win_threshold → home_win (home reached their target)
 *   2. Else if away wins ≥ away_win_threshold → away_win
 *   3. Else if both teams have non-null tie thresholds AND each team's
 *      wins match exactly its tie threshold → tie (the chart-defined
 *      tie configuration, e.g. 9-9 in BCA 3v3)
 *   4. Default fallback: 'tie' — this should never be reachable when all
 *      games are complete and thresholds are coherent. Locked here so
 *      future refactors don't change the fallback.
 *
 * Extracted from `src/components/scoring/MatchEndVerification.tsx` so the
 * logic is unit-testable and can be referenced by other scoring callers
 * (e.g. running scoreboard or match-summary card) without duplicating.
 *
 * Phase 0b characterization tests live alongside this file and lock the
 * exact behavior. Any refactor that changes the result outcome for the
 * same inputs is caught immediately.
 */

export type MatchResultOutcome = 'home_win' | 'away_win' | 'tie';

/**
 * Determine match result from scores and thresholds.
 *
 * @param homeWins - Home team's confirmed game wins
 * @param awayWins - Away team's confirmed game wins
 * @param homeWinThreshold - Home team's games-needed-to-win (chart)
 * @param awayWinThreshold - Away team's games-needed-to-win (chart)
 * @param homeTieThreshold - Home team's tie threshold; null when ties impossible
 * @param awayTieThreshold - Away team's tie threshold; null when ties impossible
 */
export function determineMatchResult(
  homeWins: number,
  awayWins: number,
  homeWinThreshold: number,
  awayWinThreshold: number,
  homeTieThreshold: number | null,
  awayTieThreshold: number | null
): MatchResultOutcome {
  // Check for wins first
  if (homeWins >= homeWinThreshold) {
    return 'home_win';
  }
  if (awayWins >= awayWinThreshold) {
    return 'away_win';
  }

  // Check for tie (only if thresholds exist)
  if (
    homeTieThreshold !== null &&
    awayTieThreshold !== null &&
    homeWins === homeTieThreshold &&
    awayWins === awayTieThreshold
  ) {
    return 'tie';
  }

  // Shouldn't happen if all games are complete
  return 'tie';
}
