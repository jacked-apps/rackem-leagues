/**
 * @fileoverview The pure middle of the engine scoring path: locked lineups +
 * games + snapshot settings in, running totals out. No database access.
 *
 * Split out of `engineRunningTotals.ts` (2026-11-17, trustworthy-tests U2) so
 * that two callers run the SAME code:
 *   - production — `computeEngineRunningTotals` reads the locked lineups from
 *     Supabase, then calls {@link computeEngineTotalsFromLineups};
 *   - the season replay test — feeds a real, anonymised season through it and
 *     checks every recorded result is reproduced.
 * Before the split, the replay would have had to re-implement this glue
 * (handicap sums, the frozen team bonus, position handicaps), testing a copy
 * of the code instead of the code.
 *
 * **Playoffs:** the team bonus is whatever was frozen into the home lineup's
 * `home_team_modifier` at prep — 0 in a playoff week (#312). Player handicaps
 * always count; only the team bonus is ever zeroed.
 *
 * @see ./engineRunningTotals.ts — production caller (DB read + never-break wrapper)
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U2)
 */

import { computeMatchRunningTotalsViaEngine } from '@/systems/points-system/match-adapter';
import type { ThresholdInputs } from '@/systems/points-system/types';
import type { EngineRunningTotalsArgs } from './engineRunningTotals';
import type { MatchRunningTotals } from './computeMatchRunningTotals';

/** A single locked-lineup row, narrowed to the handicap fields we read. */
export interface LineupRow {
  team_id: string | null;
  player1_handicap: number | null;
  player2_handicap: number | null;
  player3_handicap: number | null;
  player4_handicap: number | null;
  player5_handicap: number | null;
  home_team_modifier: number | null;
}

/**
 * Per-position handicaps in position order (index 0 = position 1). Keeps nulls
 * so the adapter can tell "no player at this position" and use 0 in formulas.
 */
export function lineupPositionHandicaps(row: LineupRow): (number | null)[] {
  return [
    row.player1_handicap,
    row.player2_handicap,
    row.player3_handicap,
    row.player4_handicap,
    row.player5_handicap,
  ];
}

/** The non-null player handicaps on a lineup row, as a ratings array. */
const lineupRatings = (row: LineupRow): number[] =>
  lineupPositionHandicaps(row).filter((h): h is number => typeof h === 'number');

/** Sum of the non-null player handicaps on a lineup row. */
const sumLineupHandicaps = (row: LineupRow): number =>
  lineupRatings(row).reduce((sum, h) => sum + h, 0);

/**
 * The handicap inputs the engine runs on: each side's ratings, the handicap
 * difference, and team totals. The home total includes the FROZEN team bonus
 * (`home_team_modifier`, mirroring prep's calculateHandicapThresholds — not a
 * fresh standings lookup). In a playoff week that bonus is 0, but the players'
 * own handicaps still count.
 *
 * @param home - home side's locked lineup
 * @param away - away side's locked lineup
 * @param regularGameCount - games excluding tiebreakers
 * @example
 * buildThresholdInputs(home, away, 18).homeTeamHandicap // player sum + team bonus
 */
export function buildThresholdInputs(
  home: LineupRow,
  away: LineupRow,
  regularGameCount: number,
): ThresholdInputs {
  const teamBonus = typeof home.home_team_modifier === 'number' ? home.home_team_modifier : 0;
  const homeTotal = sumLineupHandicaps(home) + teamBonus;
  const awayTotal = sumLineupHandicaps(away);
  return {
    homeRatings: lineupRatings(home),
    awayRatings: lineupRatings(away),
    homeHandicapDiff: homeTotal - awayTotal,
    awayHandicapDiff: awayTotal - homeTotal,
    gameCount: regularGameCount,
    prefs: {},
    // Team totals (home includes the bonus) for allocator formulas'
    // `this_side_team_handicap` / `other_side_team_handicap`.
    homeTeamHandicap: homeTotal,
    awayTeamHandicap: awayTotal,
  };
}

/**
 * Engine running totals from already-loaded lineups. Returns `null` when the
 * engine can't compute (fewer than two lineups, or a side's lineup missing) —
 * the caller then falls back to legacy, exactly as before the split.
 *
 * @param args - match ids, snapshotted thresholds, games, snapshot settings
 * @param lineups - the match's LOCKED `match_lineups` rows
 * @returns the four running totals, or null
 * @example
 * computeEngineTotalsFromLineups(args, [homeLineup, awayLineup])
 * // → { home_games_won: 10, away_games_won: 8, home_points_earned: 1, away_points_earned: -1 }
 */
export function computeEngineTotalsFromLineups(
  args: EngineRunningTotalsArgs,
  lineups: ReadonlyArray<LineupRow>,
): MatchRunningTotals | null {
  if (lineups.length < 2) return null;
  const home = lineups.find((l) => l.team_id === args.homeTeamId);
  const away = lineups.find((l) => l.team_id === args.awayTeamId);
  if (!home || !away) return null;

  const regularGameCount = args.games.filter((g) => !g.is_tiebreaker).length;
  const thresholdInputs = buildThresholdInputs(home, away, regularGameCount);

  return computeMatchRunningTotalsViaEngine({
    homeTeamId: args.homeTeamId,
    awayTeamId: args.awayTeamId,
    games: args.games,
    pointsCalculator: args.pointsCalculator,
    pointsCalculatorParams: args.pointsCalculatorParams,
    winCondition: args.winCondition,
    thresholdInputs,
    homeThresholds: args.homeThresholds,
    awayThresholds: args.awayThresholds,
    perGameAllocatorOverride: args.perGameAllocatorOverride,
    // Locked per-position handicaps, so `this_side_handicap` resolves to the
    // player who actually played each game.
    homePositionHandicaps: lineupPositionHandicaps(home),
    awayPositionHandicaps: lineupPositionHandicaps(away),
  });
}
