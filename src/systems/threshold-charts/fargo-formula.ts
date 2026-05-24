/**
 * @fileoverview FargoRate Formula Chart — continuous start-points computation.
 *
 * Per the locked FargoRate Formula variant page
 * (`docs/league-system/modules/threshold-charts/fargo-formula.md`), this is a
 * continuous-formula Chart consuming both teams' FargoRate-encoded rating
 * lists and producing the bonus-points figure for the weaker team.
 *
 * Formula (per `docs/research/fargorate-formula.md`):
 *   1. Transform each rating: T = 2^(rating/100)
 *   2. Sum both teams: T_home_sum, T_away_sum
 *   3. Total games = home.length × away.length (single round-robin)
 *   4. P(home wins per game) = T_home_sum / (T_home_sum + T_away_sum)
 *   5. Per-game expected = P_win × winner_points + P_lose × AVG_LOSER_POINTS
 *   6. start_points = floor(|home_total − away_total|)
 *   7. weakerTeam = whichever side has the lower expected total
 *
 * Extracted in Phase A of the Threshold Charts extraction Unit. Implementation
 * is byte-identical to the `computeStartPoints` function still living on
 * `fargo5v5.ts`; the legacy reference remains during the strangler-fig
 * transition (Phase C swaps consumers, Phase D removes the legacy copy).
 *
 * @see docs/league-system/modules/threshold-charts/fargo-formula.md
 * @see docs/research/fargorate-formula.md — the calibration anchor
 */

import type { SystemOverrides } from '@/types/systemOverrides';
import type { FargoStartPointsResult } from '../types';
import type { FargoFormulaChart } from './types';

// Module-local defaults — duplicated from fargo5v5.ts during Phase A. The legacy
// copies still drive the active `fargo5v5.threshold.compute` path; both copies
// must stay in sync until Phase D removes the legacy `computeStartPoints`.
const DEFAULT_WINNER_POINTS = 10;

/**
 * Empirically calibrated average loser points per game (constant). See file
 * header for the calibration rationale. If future real-match test cases
 * diverge significantly, revisit this constant or move to a gap-sensitive
 * formula.
 */
const AVG_LOSER_POINTS = 4.2;

/** Transform a single rating into FargoRate's "T" value (2^(rating/100)). */
function transformRating(rating: number): number {
  return Math.pow(2, rating / 100);
}

function resolveWinnerPoints(overrides: SystemOverrides): number {
  return overrides.winner_points ?? DEFAULT_WINNER_POINTS;
}

function computeStartPoints(
  homeRatings: number[],
  awayRatings: number[],
  overrides: SystemOverrides,
): FargoStartPointsResult {
  if (homeRatings.length === 0 || awayRatings.length === 0) {
    throw new Error('fargoFormulaChart.compute requires non-empty ratings arrays');
  }
  if (homeRatings.some((r) => !Number.isFinite(r))) {
    throw new Error('fargoFormulaChart.compute received a non-finite home rating');
  }
  if (awayRatings.some((r) => !Number.isFinite(r))) {
    throw new Error('fargoFormulaChart.compute received a non-finite away rating');
  }

  const tHome = homeRatings.reduce((sum, r) => sum + transformRating(r), 0);
  const tAway = awayRatings.reduce((sum, r) => sum + transformRating(r), 0);

  // Single round robin: every home player plays every away player once.
  const totalGames = homeRatings.length * awayRatings.length;

  const pHomeWins = tHome / (tHome + tAway);
  const pAwayWins = 1 - pHomeWins;

  const winnerPoints = resolveWinnerPoints(overrides);

  // Per-game expected score for each team.
  const homePerGame = pHomeWins * winnerPoints + pAwayWins * AVG_LOSER_POINTS;
  const awayPerGame = pAwayWins * winnerPoints + pHomeWins * AVG_LOSER_POINTS;

  // Match-level expected totals.
  const homeTotal = homePerGame * totalGames;
  const awayTotal = awayPerGame * totalGames;

  const diff = Math.abs(homeTotal - awayTotal);
  const startPoints = Math.floor(diff);

  let weakerTeam: 'home' | 'away' | 'even';
  if (startPoints === 0) {
    weakerTeam = 'even';
  } else if (homeTotal < awayTotal) {
    weakerTeam = 'home';
  } else {
    weakerTeam = 'away';
  }

  return { startPointsForWeakerTeam: startPoints, weakerTeam };
}

/**
 * FargoRate Formula Chart variant.
 *
 * Input: two arrays of FargoRate integers (100–850) — home and away rosters.
 *   Plus the league's `SystemOverrides` (consumed to resolve the
 *   `winner_points` dial; ignores all other override fields).
 *
 * Output: `FargoStartPointsResult { startPointsForWeakerTeam, weakerTeam }`
 *   where `weakerTeam` is `'home' | 'away' | 'even'`.
 *
 * Throws: if either ratings array is empty or contains non-finite values.
 */
export const fargoFormulaChart: FargoFormulaChart = {
  kind: 'fargo_formula',
  compute: computeStartPoints,
};
