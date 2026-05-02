/**
 * @fileoverview Fargo handicap → per-team games-to-win thresholds.
 *
 * Phase 3 Unit 3.2 of the modular-league-system v2 plan: implements the
 * games-won win-condition path for Fargo-rated leagues with the
 * `extra_games` mechanism. Mirrors how `get3v3GamesNeeded` /
 * `get5v5GamesNeeded` produce thresholds for BCA leagues, but operates
 * on per-player Fargo ratings rather than a handicap-difference scalar.
 *
 * The formula is derived from FargoRate's own published primitives
 * (T = 2^(rating/100); single-game win probability = T_home / (T_home + T_away))
 * and validated against FargoRate's published HOT race chart for
 * individual matchups: a 96-point rating gap on a 10-game race produces
 * exactly the 7-4 race the chart specifies.
 *
 * Why no published chart for TEAM matches: FargoRate LMS doesn't
 * support games-to-win thresholds at all — their native system uses
 * handicap *points* added to raw scores. Asymmetric games-to-win
 * thresholds are an operator design choice. The formula here is
 * derivable, calibrated against the individual-matchup HOT chart, and
 * produces sensible defaults that captains can override at lineup lock.
 *
 * @see docs/research/fargo-games-won-threshold.md (formula + calibration)
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 3.2)
 */

import type { HandicapThresholds } from '@/types';

export interface ComputeFargoGamesWonThresholdsArgs {
  /** Active home-team ratings (one entry per player in the lineup). */
  homeRatings: ReadonlyArray<number>;
  /** Active away-team ratings (one entry per player in the lineup). */
  awayRatings: ReadonlyArray<number>;
  /**
   * Total games in the match across all pairings. Drives ceiling /
   * tie-band logic. Examples:
   *   3v3 DRR  → 18
   *   5v5 SRR  → 25
   *   4v4 SRR  → 16
   *   4v4 DRR  → 32
   */
  totalGames: number;
  /**
   * Optional games-per-pairing matrix indexed `[home_i][away_j]`.
   * When omitted, the function infers it from lineup sizes and
   * `totalGames`: equal lineup sizes ⇒ each pairing plays the same
   * number of games (totalGames / (homeSize × awaySize)).
   *
   * Override when the lineup geometry isn't a uniform round-robin —
   * e.g. some pairings play 2 games while others play 1.
   */
  pairingCounts?: ReadonlyArray<ReadonlyArray<number>>;
}

export interface FargoGamesWonThresholds {
  home: HandicapThresholds;
  away: HandicapThresholds;
  /**
   * Diagnostic — useful for tooltips / wizard previews. Not consumed
   * by the runtime threshold flow.
   */
  expectedHomeWins: number;
}

/** FargoRate base transform: T = 2^(rating/100). */
function ratingToT(rating: number): number {
  return Math.pow(2, rating / 100);
}

/**
 * Build a default uniform pairing matrix. Each home/away pair plays
 * `totalGames / (home × away)` games. If that doesn't divide evenly
 * we throw — caller must supply `pairingCounts` for non-uniform
 * geometries (none ship today, but the path stays open).
 */
function defaultPairingCounts(
  homeSize: number,
  awaySize: number,
  totalGames: number,
): number[][] {
  const pairings = homeSize * awaySize;
  if (pairings === 0) {
    throw new Error(
      'computeFargoGamesWonThresholds: at least one rating per side required',
    );
  }
  const gamesPerPair = totalGames / pairings;
  if (!Number.isInteger(gamesPerPair) || gamesPerPair <= 0) {
    throw new Error(
      `computeFargoGamesWonThresholds: cannot infer uniform pairing matrix — ` +
        `${homeSize}×${awaySize} pairings × ? games = ${totalGames}. ` +
        `Pass a pairingCounts override.`,
    );
  }
  return Array.from({ length: homeSize }, () =>
    Array<number>(awaySize).fill(gamesPerPair),
  );
}

/**
 * Compute per-team games-to-win thresholds for a Fargo-rated match
 * decided by games won (BCA-style win condition).
 *
 * Behavior:
 *  - Sums per-pairing `p_home_i × games_per_pair` to get expected
 *    home wins.
 *  - Stronger team's threshold = ceil(expected wins).
 *  - Weaker team's threshold = totalGames + 1 − stronger's threshold.
 *    (Sum-to-M+1 invariant — matches the BCA `home_to_win + away_to_win
 *    = totalGames + 1` convention.)
 *  - Tie thresholds set when totalGames is even (a 9-9 outcome is
 *    possible) — `tie = win - 1` on each side. Odd totals get
 *    `games_to_tie = null`.
 *  - `games_to_lose = tie - 1` when tie band exists, otherwise null.
 *
 * @throws if rating arrays are empty, contain non-finite numbers, or
 * the inferred pairing matrix can't be uniform (override
 * `pairingCounts` to handle that case).
 */
export function computeFargoGamesWonThresholds(
  args: ComputeFargoGamesWonThresholdsArgs,
): FargoGamesWonThresholds {
  const { homeRatings, awayRatings, totalGames, pairingCounts } = args;

  if (homeRatings.length === 0 || awayRatings.length === 0) {
    throw new Error(
      'computeFargoGamesWonThresholds: both lineups must have at least one rating',
    );
  }
  for (const r of [...homeRatings, ...awayRatings]) {
    if (!Number.isFinite(r)) {
      throw new Error(
        `computeFargoGamesWonThresholds: non-finite rating in lineup (got ${r})`,
      );
    }
  }
  if (!Number.isInteger(totalGames) || totalGames <= 0) {
    throw new Error(
      `computeFargoGamesWonThresholds: totalGames must be a positive integer (got ${totalGames})`,
    );
  }

  const pcounts =
    pairingCounts ??
    defaultPairingCounts(homeRatings.length, awayRatings.length, totalGames);

  if (
    pcounts.length !== homeRatings.length ||
    pcounts.some((row) => row.length !== awayRatings.length)
  ) {
    throw new Error(
      `computeFargoGamesWonThresholds: pairingCounts shape ${pcounts.length}×` +
        `${pcounts[0]?.length ?? 0} doesn't match lineups ${homeRatings.length}×${awayRatings.length}`,
    );
  }

  const tHome = homeRatings.map(ratingToT);
  const tAway = awayRatings.map(ratingToT);

  let expectedHomeWins = 0;
  for (let i = 0; i < homeRatings.length; i += 1) {
    for (let j = 0; j < awayRatings.length; j += 1) {
      const pHome = tHome[i] / (tHome[i] + tAway[j]);
      expectedHomeWins += pHome * pcounts[i][j];
    }
  }

  // Defensive: if the rounded sum across pairings drifts off totalGames
  // (floating-point), pin it. Each pHome+pAway = 1 and counts sum to
  // totalGames, so this should never trigger — but be safe.
  if (expectedHomeWins < 0) expectedHomeWins = 0;
  if (expectedHomeWins > totalGames) expectedHomeWins = totalGames;

  const expectedAwayWins = totalGames - expectedHomeWins;

  // Pick the stronger side and ceil their target.
  let homeToWin: number;
  let awayToWin: number;
  if (expectedHomeWins >= expectedAwayWins) {
    homeToWin = Math.ceil(expectedHomeWins);
    awayToWin = totalGames + 1 - homeToWin;
  } else {
    awayToWin = Math.ceil(expectedAwayWins);
    homeToWin = totalGames + 1 - awayToWin;
  }

  // Defensive bounds: a degenerate input (e.g. one team massively
  // outclassed) shouldn't push a threshold below 1 or above totalGames.
  homeToWin = Math.max(1, Math.min(totalGames, homeToWin));
  awayToWin = Math.max(1, Math.min(totalGames, awayToWin));

  const tieBandPossible = totalGames % 2 === 0;
  const homeToTie = tieBandPossible ? homeToWin - 1 : null;
  const awayToTie = tieBandPossible ? awayToWin - 1 : null;
  const homeToLose = tieBandPossible && homeToTie !== null ? homeToTie - 1 : null;
  const awayToLose = tieBandPossible && awayToTie !== null ? awayToTie - 1 : null;

  return {
    home: {
      games_to_win: homeToWin,
      games_to_tie: homeToTie,
      games_to_lose: homeToLose,
    },
    away: {
      games_to_win: awayToWin,
      games_to_tie: awayToTie,
      games_to_lose: awayToLose,
    },
    expectedHomeWins,
  };
}
