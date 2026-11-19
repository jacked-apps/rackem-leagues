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
 * @see ./engineInputs.ts — the pure middle (shared with the season replay test)
 * @see src/systems/points-system/match-adapter.ts — the engine adapter
 */

import { supabase } from '@/supabaseClient';
import type { PerGameAllocator } from '@/systems/points-system/types';
import { computeEngineTotalsFromLineups, type LineupRow } from './engineInputs';
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
    // signal the caller to fall back to legacy. The pure part (handicap sums,
    // frozen team bonus, the engine call) lives in engineInputs.ts so the
    // season replay test runs this exact code.
    if (error || !lineups) return null;
    return computeEngineTotalsFromLineups(args, lineups as LineupRow[]);
  } catch (e) {
    // Never surface — caller falls back to legacy so the write still happens.
    console.warn(
      '[engineRunningTotals] compute failed, caller will fall back to legacy',
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}
