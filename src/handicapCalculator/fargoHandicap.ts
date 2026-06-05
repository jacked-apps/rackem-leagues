/**
 * @fileoverview Fargo team-handicap educational approximation.
 *
 * Estimates the spot games awarded to the lower-rated team in a 5v5,
 * 25-game team match using Fargo-style handicapping. Calibrated against
 * two real Fargo LMS matches:
 *   - 168 rating gap  → 2 spot games observed
 *   - 523 rating gap  → 8 spot games observed
 *
 * Fargo Rate does not publish the exact team-handicap formula, so this is
 * an approximation intended for explainer/educational use, not for
 * officiating real matches. Actual Fargo LMS values may differ by ±1-2.
 */

export const TOTAL_GAMES_PER_MATCH = 25;
export const DEFAULT_MAX_HANDICAP = 25;

export interface HandicapResult {
  homeRatingTotal: number;
  awayRatingTotal: number;
  ratingGap: number;
  spotTeam: 'home' | 'away' | null;
  spotGames: number;
  homeGamesToWin: number;
  awayGamesToWin: number;
}

/**
 * Compute the estimated handicap for a 5v5, 25-game team match.
 *
 * - spot ≈ round(gap / 65), capped at maxHandicap. Fits the calibration
 *   data: 168/65=2.6→3, 523/65=8.0→8. Real Fargo gave 2 and 8 respectively.
 * - "Games to win" = enough wins so a team's (game wins + spot) strictly
 *   beats the other team's count.
 */
export function computeHandicap(
  homeRatings: number[],
  awayRatings: number[],
  maxHandicap: number = DEFAULT_MAX_HANDICAP
): HandicapResult {
  const homeRatingTotal = homeRatings.reduce((sum, r) => sum + r, 0);
  const awayRatingTotal = awayRatings.reduce((sum, r) => sum + r, 0);
  const ratingGap = Math.abs(homeRatingTotal - awayRatingTotal);

  let spotTeam: 'home' | 'away' | null = null;
  if (homeRatingTotal > awayRatingTotal) spotTeam = 'away';
  else if (awayRatingTotal > homeRatingTotal) spotTeam = 'home';

  const spotGames = Math.min(maxHandicap, Math.round(ratingGap / 65));

  const totalPoints = TOTAL_GAMES_PER_MATCH + spotGames;
  const winThreshold = Math.floor(totalPoints / 2) + 1;

  const homeStartPoints = spotTeam === 'home' ? spotGames : 0;
  const awayStartPoints = spotTeam === 'away' ? spotGames : 0;

  const homeGamesToWin = Math.max(0, winThreshold - homeStartPoints);
  const awayGamesToWin = Math.max(0, winThreshold - awayStartPoints);

  return {
    homeRatingTotal,
    awayRatingTotal,
    ratingGap,
    spotTeam,
    spotGames,
    homeGamesToWin,
    awayGamesToWin,
  };
}
