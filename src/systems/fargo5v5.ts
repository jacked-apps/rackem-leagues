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
 *   Per-game scoring stores only `match_games.loser_value` (renamed from
 *   `loser_balls_pocketed` by Branch A) — winner and loser points are derived
 *   at read time from the league's snapshotted dials.
 *   Start-points are stored on the weaker team's `matches.home_to_win` or
 *   `matches.away_to_win` column (the stronger team's gets 0).
 */

import type {
  GameOutcome,
  GameRecordFields,
  MatchResult,
  StoredGameRecord,
  SystemModule,
} from './types';
import type { SystemOverrides } from '@/types/systemOverrides';
import { getWinCalculator } from './win-calculators';
import { getTeamGeometry } from './team-geometry';
import { getMatchFormat } from './match-format';
import { fargoRateHandicapSystem } from './handicap-systems';
import { fargoFormulaChart } from './threshold-charts';
import { createStartPointsMechanism } from './handicap-mechanisms';
import { buildFargo10pt5ManComposition } from './points-system/compositions/fargo-10pt-5-man';

// ============================================================================
// Constants (module defaults — overridable via SystemOverrides)
// ============================================================================

const DEFAULT_WINNER_POINTS = 10;
const DEFAULT_LOSER_POINTS_METHOD = 'balls_pocketed' as const;
const DEFAULT_LOSER_POINTS_MAX = 7;

function resolveWinnerPoints(overrides: SystemOverrides): number {
  return overrides.winner_points ?? DEFAULT_WINNER_POINTS;
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
  // Per the revised schema, Fargo stores only the loser-side value (renamed from
  // loser_balls_pocketed to loser_value by Branch A). Winner points and loser
  // points are derived at read time from the snapshotted dials. winner_value
  // stays null for today's calculators (kind: 'fixed' on winner side).
  const loserBalls = clampLoserBalls(outcome.loserValue, overrides);
  return {
    winner_points: null,
    loser_points: null,
    winner_value: null,
    loser_value: loserBalls,
  };
}

/** Derive loser points for a stored game based on the league's loser_points_method dial. */
function deriveLoserPoints(
  loserValue: number | null,
  overrides: SystemOverrides,
): number {
  const method = overrides.loser_points_method ?? DEFAULT_LOSER_POINTS_METHOD;
  if (method === 'none') return 0;
  if (method === 'fixed') {
    // Fixed value for every loss — default uses loser_points_max as the fixed value.
    return overrides.loser_points_max ?? DEFAULT_LOSER_POINTS_MAX;
  }
  // 'balls_pocketed' — read the stored value (0 if not recorded for some reason)
  return loserValue ?? 0;
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
    const loserPoints = deriveLoserPoints(g.loser_value, overrides);
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
  // games-won is always decisive when points tie, so no tie result is
  // reachable here.
  //
  // TODO: when an even-games points-scored format lands (e.g. 4v4 = 16
  // games, 3v3 = 18 games) it becomes possible for both points AND games
  // to tie. The `else winner = 'away'` fallback below is arbitrary and
  // needs a real rule. Candidates: most 10-0 sweeps, start-points
  // recipient wins, declared tie with league-level sudden-death rule.
  // Pick when a real league's tiebreaker is known; don't guess.
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

  // Team Geometry Module — the three structural axes plus derived gameCount.
  // Replaces the legacy teamFormat field (Phase D of the Team Geometry migration).
  teamGeometry: getTeamGeometry(5, 8, 'single_round_robin'),

  // Match Format Module — Fargo 5v5 ships single_rack pairings (no race_length).
  // See bca3v3.ts for the strangler-fig rationale.
  matchFormat: getMatchFormat('single_rack', null),

  scoring: {
    method: 'points_accumulated',
    recordGameOutcome,
    computeMatchResult,
  },

  // Fargo 5v5 ships with win_condition='points' — a one-entry metric stack with
  // points_earned. Per Unit 1 of the modular-framework migration plan, this Module
  // shape replaces the runtime branching on win_condition. Consumers call
  // winCalculator.decide(matchData) instead of switching on win_condition inline.
  winCalculator: getWinCalculator('points'),

  // Handicap System Module — FargoRate variant (integer 100–850, manually entered).
  // Replaces the legacy `rating` capability deleted in Phase D of Handicap Systems.
  handicapSystem: fargoRateHandicapSystem,

  // Threshold Chart Module — FargoRate Formula chart (FargoRate × start_points).
  // Owns the start-points formula. Consumers route through the Handicap Mechanism
  // (below); the Chart is the data layer the Mechanism delegates to.
  thresholdChart: fargoFormulaChart,

  // Handicap Mechanism Module — start_points bound to the FargoRate Formula Chart.
  // Coexists with `threshold` until Phase D.
  handicapMechanism: createStartPointsMechanism(fargoFormulaChart),

  // Points System Module — FargoRate 10-Point 5-Man composition: 2 receipt
  // triggers (award handicap-driven initial points to each side) + per-game
  // allocator (winner = 10 fixed, loser = counter 0-7 balls pocketed).
  // The initial points value is read from prefs at evaluation time (caller
  // pre-computes via the Handicap Mechanism's start_points logic per the
  // D3 dual-identity resolution).
  pointsSystem: buildFargo10pt5ManComposition({}),
};
