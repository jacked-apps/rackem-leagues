/**
 * @fileoverview Per-mutation running-totals calculator for the match row.
 *
 * Phase 5 Unit 5.5 of the modular-league-system v2 plan: when a per-game
 * scoring mutation lands, the match row's `home_games_won` /
 * `away_games_won` / `home_points_earned` / `away_points_earned` columns
 * become the source of truth — eagerly recomputed from the full set of
 * confirmed `match_games` rows on each mutation, and written back into the
 * match row in the same flow.
 *
 * Why eager recompute (not incremental delta)?
 *  - Aggregate calculators (`linear_above_threshold`,
 *    `accumulate_with_milestone_jumps`) compute points as a function of the
 *    team's *total* games-won. They aren't naturally incremental — a single
 *    new game-won can produce a non-linear jump (tie-band crossing, milestone
 *    bonus). Recomputing from the full count is the only correct path.
 *  - Per-game calculators (`accumulated_per_game`) ARE naturally incremental,
 *    but a uniform "always recompute" pattern handles every state change
 *    (insert / update / confirm / deny / vacate) without per-path logic.
 *  - The recomputation is bounded: O(games_in_match), max ~21 rows. Cheap.
 *
 * The match record is the source of truth in real-time. There is NO match-end
 * recompute layer — Match completion (Phase 5's `MatchEndVerification`) just
 * persists the already-correct totals to status='completed' and writes
 * winner_team_id. A separate, silent post-completion audit (Unit 5.6) catches
 * any divergence between the running totals and a fresh recomputation.
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 5.5)
 */

import type { HandicapThresholds } from '@/types/match';
import { getCalculator } from '@/systems/calculators';

/**
 * Minimal `match_games` row shape this helper consumes. Captures only the
 * fields required for running-total math; the actual `MatchGame` row has
 * many more fields (achievements, positions, etc.) that don't affect totals.
 */
export interface MinimalMatchGame {
  /** Winning team's ID. `null` for unscored or vacated games. */
  winner_team_id: string | null;
  /**
   * Calculator-driven per-game input value collected from the winner side.
   * NULL when the calculator declares winner side as kind: 'fixed' (no input).
   */
  winner_value: number | null;
  /**
   * Calculator-driven per-game input value collected from the loser side
   * (e.g. balls pocketed in Fargo 10-7). Renamed from loser_balls_pocketed
   * by Branch A.
   */
  loser_value: number | null;
  /** Whether this game was played as a tiebreaker. Excluded from regular running totals. */
  is_tiebreaker: boolean;
  /** Member ID of the home-team confirmer. `null` until home confirms. */
  confirmed_by_home: string | null;
  /** Member ID of the away-team confirmer. `null` until away confirms. */
  confirmed_by_away: string | null;
}

export interface ComputeMatchRunningTotalsArgs {
  /** Home team's ID — used to attribute games-won + select per-side thresholds. */
  homeTeamId: string;
  /** Away team's ID — same as home but for the away side. */
  awayTeamId: string;
  /**
   * Home team's handicap thresholds (games_to_win / games_to_tie /
   * games_to_lose) snapshotted on the match row. Aggregate calculators read
   * these to determine band placement.
   */
  homeThresholds: HandicapThresholds;
  /** Away team's handicap thresholds — same as home but for the away side. */
  awayThresholds: HandicapThresholds;
  /**
   * The full set of `match_games` rows for this match. May contain unscored,
   * unconfirmed, denied, vacated, or tiebreaker games — this helper filters
   * appropriately. Order doesn't matter.
   */
  games: ReadonlyArray<MinimalMatchGame>;
  /**
   * Calculator name (from `match.system_snapshot.points_calculator`). When
   * `null` the league does not track points and `home_points_earned` /
   * `away_points_earned` are returned as 0.
   */
  pointsCalculator: string | null;
  /**
   * Calculator-specific parameter object (from
   * `match.system_snapshot.points_calculator_params`). Forwarded to the
   * registered calculator's `compute` method without inspection.
   */
  pointsCalculatorParams: Record<string, unknown>;
  /**
   * Match win condition (from `match.system_snapshot.win_condition` or live
   * preferences fallback). When `'points'`, the start-credit stored on
   * `*_to_tie` is folded into the points total (per Ed's 2026-05-04 spec:
   * "the lower team gets +50 they start the game 50 ... these are EARNED
   * points like a win gives you 10"). When `'games'`, start-credit is
   * irrelevant and points are pure calculator output.
   */
  winCondition: 'games' | 'points';
}

export interface MatchRunningTotals {
  home_games_won: number;
  away_games_won: number;
  home_points_earned: number;
  away_points_earned: number;
}

/**
 * Compute the four running totals for the match row from the current set of
 * `match_games` rows.
 *
 * Behavior:
 *  - Only fully-confirmed (both `confirmed_by_home` AND `confirmed_by_away`)
 *    games count. Pending confirmations don't move totals — that prevents
 *    flicker and keeps the match row consistent with what both teams have
 *    actually agreed to.
 *  - Tiebreaker games (`is_tiebreaker = true`) are excluded from regular
 *    running totals. The tiebreaker's effect on the final result is decided
 *    at match completion (winner team), not by accumulating regular game
 *    counts.
 *  - When `pointsCalculator` is `null`, both points totals return 0. The
 *    league simply does not track points.
 *  - When `pointsCalculator` is set but no calculator with that name is
 *    registered, the function logs a warning and returns 0 points (graceful
 *    degradation per the plan: "match doesn't break, gets played, honest
 *    labels"). Game counts still update normally.
 *
 * Returns a fresh object — caller writes it to the match row.
 */
export function computeMatchRunningTotals(
  args: ComputeMatchRunningTotalsArgs,
): MatchRunningTotals {
  const {
    homeTeamId,
    awayTeamId,
    homeThresholds,
    awayThresholds,
    games,
    pointsCalculator,
    pointsCalculatorParams,
    winCondition,
  } = args;

  const confirmedRegular = games.filter(
    (g) =>
      g.winner_team_id !== null &&
      g.confirmed_by_home !== null &&
      g.confirmed_by_away !== null &&
      !g.is_tiebreaker,
  );

  let home_games_won = 0;
  let away_games_won = 0;
  for (const g of confirmedRegular) {
    if (g.winner_team_id === homeTeamId) home_games_won += 1;
    else if (g.winner_team_id === awayTeamId) away_games_won += 1;
  }

  // 'none' is the explicit "don't track points" sentinel (migration
  // 20260503000000 replaced the buggy NULL convention). Both values
  // short-circuit to zero — null appears here only for legacy match
  // snapshots captured before the migration ran, kept defensively.
  if (pointsCalculator === null || pointsCalculator === 'none') {
    return {
      home_games_won,
      away_games_won,
      home_points_earned: 0,
      away_points_earned: 0,
    };
  }

  const calc = getCalculator(pointsCalculator);
  if (!calc) {
    console.warn(
      `[computeMatchRunningTotals] No calculator registered for points_calculator=${JSON.stringify(pointsCalculator)} — returning zero points (game counts unaffected)`,
    );
    return {
      home_games_won,
      away_games_won,
      home_points_earned: 0,
      away_points_earned: 0,
    };
  }

  let home_points_earned = 0;
  let away_points_earned = 0;

  if (calc.kind === 'aggregate') {
    home_points_earned = calc.compute(
      { gamesWon: home_games_won, thresholds: homeThresholds },
      pointsCalculatorParams,
    );
    away_points_earned = calc.compute(
      { gamesWon: away_games_won, thresholds: awayThresholds },
      pointsCalculatorParams,
    );
  } else {
    const inputGames = confirmedRegular.map((g) => ({
      winner_team_id: g.winner_team_id,
      winner_score: g.winner_value,
      loser_score: g.loser_value,
      is_tiebreaker: g.is_tiebreaker,
    }));
    home_points_earned = calc.compute(
      { games: inputGames, teamId: homeTeamId },
      pointsCalculatorParams,
    );
    away_points_earned = calc.compute(
      { games: inputGames, teamId: awayTeamId },
      pointsCalculatorParams,
    );
  }

  // Points-mode start-credit fold-in (per Ed's 2026-05-04 spec). The credit
  // stored on *_to_tie is treated as part of the team's points total — match
  // begins with weaker team at +N, opponent at 0, and per-game wins add on
  // top. Games-mode matches don't have a start-credit semantic, so this
  // fold-in is points-mode-only.
  if (winCondition === 'points') {
    const homeStartCredit = homeThresholds.games_to_tie ?? 0;
    const awayStartCredit = awayThresholds.games_to_tie ?? 0;
    home_points_earned += homeStartCredit;
    away_points_earned += awayStartCredit;
  }

  return {
    home_games_won,
    away_games_won,
    home_points_earned,
    away_points_earned,
  };
}
