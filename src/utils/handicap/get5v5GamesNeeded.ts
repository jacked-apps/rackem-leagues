/**
 * @fileoverview 5v5 BCA Handicap Chart Lookup (Hard-coded)
 *
 * Static lookup table for 5v5 (8-man league) handicap thresholds.
 * Based on BCA Standard Handicap System.
 * 25 total games per match (single round-robin).
 *
 * Source: BCA_HANDICAP_SYSTEM.md
 */

export interface HandicapThresholds {
  games_to_win: number;
  games_to_tie: number | null;
  games_to_lose: number;
}

/**
 * BCA 5v5 Handicap Chart - Range-based lookup
 *
 * Instead of 1000+ rows, we use 7 ranges with separate values for higher/lower teams.
 * Handicap differences are percentage-based (0-500 range).
 *
 * IMPORTANT: The lower team's games_to_win is NOT simply (25 - higherTeamWins).
 * Each team has its own lookup value from the BCA chart.
 */
const BCA_5V5_RANGES: Array<{
  minDiff: number;
  maxDiff: number;
  higherTeamWins: number;  // Games needed by HIGHER handicap team
  lowerTeamWins: number;   // Games needed by LOWER handicap team
}> = [
  // Format: [min, max, higher_team_wins, lower_team_wins]
  { minDiff: 0, maxDiff: 14, higherTeamWins: 13, lowerTeamWins: 13 },
  { minDiff: 15, maxDiff: 40, higherTeamWins: 14, lowerTeamWins: 12 },
  { minDiff: 41, maxDiff: 66, higherTeamWins: 15, lowerTeamWins: 11 },
  { minDiff: 67, maxDiff: 92, higherTeamWins: 16, lowerTeamWins: 10 },
  { minDiff: 93, maxDiff: 118, higherTeamWins: 17, lowerTeamWins: 9 },
  { minDiff: 119, maxDiff: 144, higherTeamWins: 18, lowerTeamWins: 8 },
  { minDiff: 145, maxDiff: 999, higherTeamWins: 19, lowerTeamWins: 7 }, // 145+ capped
];

/**
 * Get games needed to win/lose for 5v5 match based on handicap difference
 *
 * Uses range-based lookup from BCA chart.
 * No ties possible in 5v5 (25 games = odd number).
 *
 * @param handicapDiff - Handicap difference (percentage-based, 0-500 range)
 * @returns Handicap thresholds (games_to_win, games_to_tie=null, games_to_lose)
 *
 * @example
 * // Team A: 276%, Team B: 260% → diff = 16
 * const thresholds = get5v5GamesNeeded(16);
 * console.log(thresholds.games_to_win); // 14
 *
 * @example
 * // Lower handicap team (negative diff)
 * const thresholds = get5v5GamesNeeded(-40);
 * console.log(thresholds.games_to_win); // 12
 */
export function get5v5GamesNeeded(handicapDiff: number): HandicapThresholds {
  const absDiff = Math.abs(Math.round(handicapDiff));
  const isHigherHandicap = handicapDiff >= 0;

  // Find matching range
  const range = BCA_5V5_RANGES.find(
    (r) => absDiff >= r.minDiff && absDiff <= r.maxDiff
  );

  if (!range) {
    throw new Error(`Invalid handicap difference: ${handicapDiff}`);
  }

  // Look up the correct value based on whether this team is higher or lower handicap
  // Each team has its own games_to_win value from the BCA chart
  const gamesNeeded = isHigherHandicap ? range.higherTeamWins : range.lowerTeamWins;
  const opponentGamesNeeded = isHigherHandicap ? range.lowerTeamWins : range.higherTeamWins;

  // games_to_lose = my wins when I've decisively lost the match. When my
  // opponent reaches their games_to_win (and the match ends), I have
  // exactly (totalGames - opponent's games_to_win) wins. That's the
  // "you've lost" number for me.
  //
  // Example (BCA 5v5, 25 games, handicap diff 15-40):
  //   higher team: w=14, opponent's w=12, my to_lose = 25 - 12 = 13
  //   lower team:  w=12, opponent's w=14, my to_lose = 25 - 14 = 11
  //
  // Pre-2026-05-04 this used `opponent's_to_win - 1`, which produced
  // semantically-meaningless values (e.g., lower team's w=12, l=13 —
  // reaching 13 wins would mean you've already won, not lost). Verified
  // against the BCA 3v3 hardcoded chart: for diff 0 with 18 total games,
  // w=10 and l=8 — i.e., l = 18 - 10 = totalGames - opponent's_to_win. ✓
  const TOTAL_GAMES_5V5_SINGLE_RR = 25;
  return {
    games_to_win: gamesNeeded,
    games_to_tie: null, // No ties in 25-game format
    games_to_lose: TOTAL_GAMES_5V5_SINGLE_RR - opponentGamesNeeded,
  };
}
