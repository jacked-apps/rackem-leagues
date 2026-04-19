/**
 * @fileoverview Fargo 5v5 SystemModule — real Fargo math (Unit 10)
 *
 * Fargo-rating-based system for a 5-player lineup single-round-robin format (25 games).
 * Ratings are externally sourced (100-850, manually entered at lineup time until
 * FargoRate API access lands).
 *
 * Scoring model (per league overrides, default values shown):
 *   winner_points = 10
 *   loser_points_method = 'balls_pocketed' → loser_points = balls pocketed (0-7)
 *   loser_points_max = 7
 *
 * Start-points calculation (awarded to the weaker team at match start):
 *   See docs/research/fargorate-formula.md for the authoritative formula.
 *
 *   1. Transform each player's rating: T = 2^(rating/100)
 *   2. Sum both teams: T_home_sum, T_away_sum
 *   3. Total games in match = homeRatings.length × awayRatings.length (SRR)
 *   4. Expected wins for home = (T_home_sum / (T_home_sum + T_away_sum)) × N
 *   5. Expected per-game scores:
 *        E[home_score_per_game] = P(home wins) × winner_points
 *                               + P(home loses) × avg_loser_points
 *        (symmetric for away)
 *   6. Match-level expected totals = N × per-game values
 *   7. start_points = floor(|home_total − away_total|)
 *   8. weakerTeam = whichever team has lower expected total
 *
 *   The `avg_loser_points` constant is empirically calibrated. With winner_points=10
 *   and the single captured real-match test case (117-point rating gap → 56 start
 *   points per the official FargoRate calculator), avg_loser_points = 4.2 produces
 *   56 exactly. Future test cases may warrant a gap-sensitive interpolation;
 *   v1 uses the constant and relies on the captain override-at-lineup-lock flow
 *   to catch any drift from the official number.
 *
 * Storage:
 *   Per-game scoring stores only `match_games.loser_balls_pocketed` — winner and
 *   loser points are derived at read time from the league's snapshotted dials.
 *   Start-points are stored on the weaker team's `matches.home_games_to_win` or
 *   `matches.away_games_to_win` column (the stronger team's gets 0).
 */

import type {
  FargoStartPointsResult,
  GameOutcome,
  GameRecordFields,
  MatchResult,
  RatingValidationResult,
  RatingValue,
  StoredGameRecord,
  SystemModule,
} from './types';
import type { SystemOverrides } from '@/types/systemOverrides';

// ============================================================================
// Constants (module defaults — overridable via SystemOverrides)
// ============================================================================

const DEFAULT_WINNER_POINTS = 10;
const DEFAULT_LOSER_POINTS_METHOD = 'balls_pocketed' as const;
const DEFAULT_LOSER_POINTS_MAX = 7;

/**
 * Empirically calibrated average loser points per game. Used in the start-points
 * formula to estimate the per-game point differential. See file header for the
 * calibration note. If future real-match test cases diverge significantly from
 * our computed value, revisit this constant or move to a gap-sensitive formula.
 */
const AVG_LOSER_POINTS = 4.2;

// ============================================================================
// Rating
// ============================================================================

const FARGO_RATING_MIN = 100;
const FARGO_RATING_MAX = 850;

function validateRating(value: unknown): RatingValidationResult {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, message: 'Fargo rating must be a number' };
  }
  if (!Number.isInteger(value)) {
    return { ok: false, message: 'Fargo rating must be a whole integer' };
  }
  if (value < FARGO_RATING_MIN || value > FARGO_RATING_MAX) {
    return {
      ok: false,
      message: `Fargo rating must be between ${FARGO_RATING_MIN} and ${FARGO_RATING_MAX}`,
    };
  }
  return { ok: true, value };
}

// ============================================================================
// Threshold (start-points formula)
// ============================================================================

/** Transform a single rating into FargoRate's "T" value (2^(rating/100)). */
function transformRating(rating: RatingValue): number {
  return Math.pow(2, rating / 100);
}

function resolveWinnerPoints(overrides: SystemOverrides): number {
  return overrides.winner_points ?? DEFAULT_WINNER_POINTS;
}

function computeStartPoints(
  homeRatings: RatingValue[],
  awayRatings: RatingValue[],
  overrides: SystemOverrides,
): FargoStartPointsResult {
  if (homeRatings.length === 0 || awayRatings.length === 0) {
    throw new Error('fargo5v5.threshold.compute requires non-empty ratings arrays');
  }
  if (homeRatings.some((r) => !Number.isFinite(r))) {
    throw new Error('fargo5v5.threshold.compute received a non-finite home rating');
  }
  if (awayRatings.some((r) => !Number.isFinite(r))) {
    throw new Error('fargo5v5.threshold.compute received a non-finite away rating');
  }

  const tHome = homeRatings.reduce((sum, r) => sum + transformRating(r), 0);
  const tAway = awayRatings.reduce((sum, r) => sum + transformRating(r), 0);

  // Single round robin: every home player plays every away player once
  const totalGames = homeRatings.length * awayRatings.length;

  const pHomeWins = tHome / (tHome + tAway);
  const pAwayWins = 1 - pHomeWins;

  const winnerPoints = resolveWinnerPoints(overrides);

  // Per-game expected score for each team
  const homePerGame = pHomeWins * winnerPoints + pAwayWins * AVG_LOSER_POINTS;
  const awayPerGame = pAwayWins * winnerPoints + pHomeWins * AVG_LOSER_POINTS;

  // Match-level expected totals
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

// ============================================================================
// Scoring
// ============================================================================

function clampLoserBalls(
  balls: number | null | undefined,
  overrides: SystemOverrides,
): number | null {
  if (balls == null) return null;
  if (!Number.isFinite(balls)) return null;
  const max = overrides.loser_points_max ?? DEFAULT_LOSER_POINTS_MAX;
  return Math.max(0, Math.min(max, Math.floor(balls)));
}

function recordGameOutcome(
  outcome: GameOutcome,
  overrides: SystemOverrides,
): GameRecordFields {
  // Per the revised schema, Fargo stores only loser_balls_pocketed. Winner points
  // and loser points are derived at read time from the snapshotted dials.
  const loserBalls = clampLoserBalls(outcome.loserBallsPocketed, overrides);
  return {
    winner_points: null,
    loser_points: null,
    loser_balls_pocketed: loserBalls,
  };
}

/** Derive loser points for a stored game based on the league's loser_points_method dial. */
function deriveLoserPoints(
  loserBallsPocketed: number | null,
  overrides: SystemOverrides,
): number {
  const method = overrides.loser_points_method ?? DEFAULT_LOSER_POINTS_METHOD;
  if (method === 'none') return 0;
  if (method === 'fixed') {
    // Fixed value for every loss — default uses loser_points_max as the fixed value.
    return overrides.loser_points_max ?? DEFAULT_LOSER_POINTS_MAX;
  }
  // 'balls_pocketed' — read the stored value (0 if not recorded for some reason)
  return loserBallsPocketed ?? 0;
}

function computeMatchResult(
  games: StoredGameRecord[],
  overrides: SystemOverrides,
  context?: { fargoStartPoints?: number; fargoStartPointsFor?: 'home' | 'away' | 'even' },
): MatchResult {
  const winnerPoints = resolveWinnerPoints(overrides);

  let homePoints = 0;
  let awayPoints = 0;
  let homeGames = 0;
  let awayGames = 0;

  for (const g of games) {
    const loserPoints = deriveLoserPoints(g.loser_balls_pocketed, overrides);
    if (g.winner_team === 'home') {
      homePoints += winnerPoints;
      awayPoints += loserPoints;
      homeGames += 1;
    } else {
      awayPoints += winnerPoints;
      homePoints += loserPoints;
      awayGames += 1;
    }
  }

  // Add Fargo start-points credit to the weaker team
  const startPoints = context?.fargoStartPoints ?? 0;
  if (startPoints > 0 && context?.fargoStartPointsFor === 'home') {
    homePoints += startPoints;
  } else if (startPoints > 0 && context?.fargoStartPointsFor === 'away') {
    awayPoints += startPoints;
  }

  // Cascade: higher points → higher games won. In Fargo 5v5 (25 games odd),
  // games-won is always decisive when points tie. No tie result possible.
  let winner: 'home' | 'away';
  if (homePoints > awayPoints) {
    winner = 'home';
  } else if (awayPoints > homePoints) {
    winner = 'away';
  } else if (homeGames > awayGames) {
    winner = 'home';
  } else {
    winner = 'away';
  }

  return {
    winner,
    home_points: homePoints,
    away_points: awayPoints,
    home_games_won: homeGames,
    away_games_won: awayGames,
  };
}

// ============================================================================
// Module
// ============================================================================

export const fargo5v5: SystemModule = {
  key: 'fargo5v5',

  teamFormat: {
    lineupSize: 5,
    maxRosterSize: 8,
    gameGeneration: 'single_round_robin',
  },

  rating: {
    requiresManualEntry: true,
    // Fargo ratings are externally sourced; no history-based computation.
    computeFromHistory: () => null,
    displayFormat: (value) => String(Math.round(value)),
    validate: validateRating,
  },

  scoring: {
    method: 'points_accumulated',
    recordGameOutcome,
    computeMatchResult,
  },

  threshold: {
    mode: 'start_points',
    compute: computeStartPoints,
  },
};
