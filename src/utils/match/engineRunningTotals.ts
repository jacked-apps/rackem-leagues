/**
 * @fileoverview Engine running-totals — the NEW modular Points System path.
 *
 * Computes a match's four running totals via the new composable engine
 * (`computeMatchRunningTotalsViaEngine`). After the Strand-B flip this is the
 * SOURCE OF TRUTH for the points columns; legacy `computeMatchRunningTotals`
 * stays alongside as the fallback + auditor (the "two paths audit each other"
 * pattern), reversed from the earlier shadow phase.
 *
 * **Never-break contract.** `computeEngineRunningTotals` NEVER throws. If it
 * can't compute (no locked lineups, bad inputs, anything unexpected) it returns
 * `null` and the caller falls back to the legacy totals — so the match row's
 * columns are always populated and live scoring is never interrupted. Games-won
 * is recorded on a separate sacred path regardless.
 *
 * **Frozen-snapshot inputs (per Ed, 2026-05-21).** The engine is fed the
 * prep-time snapshot, never live values: the snapshotted threshold columns off
 * the match row, plus the LOCKED `match_lineups` (frozen ratings + the frozen
 * `home_team_modifier` team bonus). Thresholds/ratings are read once and stay
 * stable for the whole match — a mid-match handicap change cannot move them.
 *
 * @see ./computeMatchRunningTotals.ts — the legacy path (fallback + auditor)
 * @see src/systems/points-system/match-adapter.ts — the engine adapter
 */

import { supabase } from '@/supabaseClient';
import { computeMatchRunningTotalsViaEngine } from '@/systems/points-system/match-adapter';
import type { PerGameAllocator, ThresholdInputs } from '@/systems/points-system/types';
import type { HandicapThresholds } from '@/types/match';
import type {
  MatchRunningTotals,
  MinimalMatchGame,
} from './computeMatchRunningTotals';

/** Inputs the seam already has in hand (match row + games + snapshot prefs). */
export interface EngineRunningTotalsArgs {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Snapshotted per-side thresholds read off the match row. */
  homeThresholds: HandicapThresholds;
  awayThresholds: HandicapThresholds;
  /** The full `match_games` set (same array fed to legacy). */
  games: ReadonlyArray<MinimalMatchGame>;
  pointsCalculator: string | null;
  pointsCalculatorParams: Record<string, unknown>;
  winCondition: 'games' | 'points';
  /**
   * Per-Game Allocator Room override (Unit 5). Sourced from the match
   * snapshot's `per_game_allocator` field. When non-null, the prepackaged
   * composition's allocator slot is replaced before evaluation. Null or
   * undefined = today's behavior.
   */
  perGameAllocatorOverride?: PerGameAllocator | null;
}

/** A single locked-lineup row, narrowed to the handicap fields we read. */
interface LineupRow {
  team_id: string | null;
  player1_handicap: number | null;
  player2_handicap: number | null;
  player3_handicap: number | null;
  player4_handicap: number | null;
  player5_handicap: number | null;
  home_team_modifier: number | null;
}

/** Sum the non-null player handicaps on a lineup row. */
function sumLineupHandicaps(row: LineupRow): number {
  return [
    row.player1_handicap,
    row.player2_handicap,
    row.player3_handicap,
    row.player4_handicap,
    row.player5_handicap,
  ].reduce<number>((sum, h) => sum + (typeof h === 'number' ? h : 0), 0);
}

/** The non-null player handicaps on a lineup row, as a ratings array. */
function lineupRatings(row: LineupRow): number[] {
  return [
    row.player1_handicap,
    row.player2_handicap,
    row.player3_handicap,
    row.player4_handicap,
    row.player5_handicap,
  ].filter((h): h is number => typeof h === 'number');
}

/**
 * Per-position handicaps for a lineup row, in position order (index 0 =
 * position 1, …). Preserves nulls so the adapter's lookup can detect
 * "no player at this position" and fall back to 0 in the formula
 * context.
 */
function lineupPositionHandicaps(row: LineupRow): (number | null)[] {
  return [
    row.player1_handicap,
    row.player2_handicap,
    row.player3_handicap,
    row.player4_handicap,
    row.player5_handicap,
  ];
}

/**
 * Whether two running-totals results differ. Game counts are integers and must
 * match exactly; points tolerate IEEE-754 last-bit noise (the percentage engine
 * accumulates `0.1`-style increments per game, vs legacy's closed form).
 */
export function runningTotalsDiffer(
  a: MatchRunningTotals,
  b: MatchRunningTotals,
): boolean {
  return (
    a.home_games_won !== b.home_games_won ||
    a.away_games_won !== b.away_games_won ||
    Math.abs(a.home_points_earned - b.home_points_earned) > 1e-6 ||
    Math.abs(a.away_points_earned - b.away_points_earned) > 1e-6
  );
}

/**
 * Compute the four running totals via the new modular engine from the frozen
 * prep snapshot. Returns `null` (never throws) when it can't compute — caller
 * falls back to legacy. Reads the LOCKED `match_lineups` for ratings + the
 * frozen team bonus; thresholds come from the snapshotted match-row columns.
 */
export async function computeEngineRunningTotals(
  args: EngineRunningTotalsArgs,
): Promise<MatchRunningTotals | null> {
  try {
    const { data: lineups, error } = await supabase
      .from('match_lineups')
      .select(
        'team_id, player1_handicap, player2_handicap, player3_handicap, player4_handicap, player5_handicap, home_team_modifier',
      )
      .eq('match_id', args.matchId)
      .eq('locked', true);

    // Without both locked lineups the engine can't resolve handicap inputs —
    // signal the caller to fall back to legacy.
    if (error || !lineups || lineups.length < 2) return null;

    const home = (lineups as LineupRow[]).find((l) => l.team_id === args.homeTeamId);
    const away = (lineups as LineupRow[]).find((l) => l.team_id === args.awayTeamId);
    if (!home || !away) return null;

    // Handicap diff, mirroring prep's calculateHandicapThresholds: the team
    // bonus is the FROZEN home_team_modifier (not a fresh standings lookup),
    // applied to the home side only.
    const teamBonus =
      typeof home.home_team_modifier === 'number' ? home.home_team_modifier : 0;
    const homeTotal = sumLineupHandicaps(home) + teamBonus;
    const awayTotal = sumLineupHandicaps(away);

    const thresholdInputs: ThresholdInputs = {
      homeRatings: lineupRatings(home),
      awayRatings: lineupRatings(away),
      homeHandicapDiff: homeTotal - awayTotal,
      awayHandicapDiff: awayTotal - homeTotal,
      gameCount: args.games.filter((g) => !g.is_tiebreaker).length,
      prefs: {},
      // Team handicap totals — home includes the locked team bonus,
      // away is just the sum of the lineup. Runtime writes these into
      // the state bag at match start so allocator formulas can reference
      // them via `this_side_team_handicap` / `other_side_team_handicap`.
      homeTeamHandicap: homeTotal,
      awayTeamHandicap: awayTotal,
    };

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
      // Locked per-position handicaps so allocator formulas can resolve
      // `this_side_handicap` / `other_side_handicap` against the actual
      // player who played each game.
      homePositionHandicaps: lineupPositionHandicaps(home),
      awayPositionHandicaps: lineupPositionHandicaps(away),
    });
  } catch (e) {
    // Never surface — caller falls back to legacy so the write still happens.
    console.warn(
      '[engineRunningTotals] compute failed, caller will fall back to legacy',
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}
