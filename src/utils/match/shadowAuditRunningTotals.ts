/**
 * @fileoverview Shadow audit for the Strand-B points cutover.
 *
 * Runs the NEW modular Points System engine
 * (`computeMatchRunningTotalsViaEngine`) ALONGSIDE the legacy
 * `computeMatchRunningTotals` on every real scoring mutation, compares the
 * four running totals, and logs any divergence — **without ever affecting the
 * legacy write.** This is the "shadow" phase of the strangler-fig migration:
 * the legacy path stays the source of truth and keeps writing the match row;
 * the engine path only observes, so we can prove it matches on real data
 * before flipping live scoring over to it.
 *
 * **Never-break contract.** This helper is fire-and-forget and fully
 * try/catch-wrapped. It must NEVER throw, never block, and never touch the
 * match row — a bug here can only produce a log line, never a scoring error.
 *
 * **Frozen-snapshot inputs (per Ed, 2026-05-21).** The engine is fed the
 * prep-time snapshot, never live values: the snapshotted threshold columns off
 * the match row, plus the LOCKED `match_lineups` (frozen ratings + the frozen
 * `home_team_modifier` team bonus). Thresholds/ratings are read once and stay
 * stable for the whole match — a mid-match handicap change cannot move them.
 *
 * @see ./computeMatchRunningTotals.ts — the legacy source of truth
 * @see src/systems/points-system/match-adapter.ts — the engine adapter under audit
 */

import { supabase } from '@/supabaseClient';
import { computeMatchRunningTotalsViaEngine } from '@/systems/points-system/match-adapter';
import type { ThresholdInputs } from '@/systems/points-system/types';
import type { HandicapThresholds } from '@/types/match';
import type {
  MatchRunningTotals,
  MinimalMatchGame,
} from './computeMatchRunningTotals';

/** Inputs the seam already has in hand when it calls the shadow audit. */
export interface ShadowAuditArgs {
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
  /** What legacy just computed — the reference to compare the engine against. */
  legacyTotals: MatchRunningTotals;
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

/** Points are float-accumulated in the engine; tolerate last-bit noise only. */
function pointsDiffer(a: number, b: number): boolean {
  return Math.abs(a - b) > 1e-6;
}

/**
 * Compute the new-engine totals from the frozen snapshot and compare to the
 * legacy totals. Logs a structured divergence warning on mismatch; otherwise
 * silent. Never throws — any failure (lineup read, build, eval) is swallowed
 * with a debug-level note so the live scoring write is never disturbed.
 */
export async function shadowAuditRunningTotals(
  args: ShadowAuditArgs,
): Promise<void> {
  try {
    // Frozen ratings + team bonus come from the LOCKED lineup snapshot.
    const { data: lineups, error } = await supabase
      .from('match_lineups')
      .select(
        'team_id, player1_handicap, player2_handicap, player3_handicap, player4_handicap, player5_handicap, home_team_modifier',
      )
      .eq('match_id', args.matchId)
      .eq('locked', true);

    if (error || !lineups || lineups.length < 2) {
      // Can't audit without both locked lineups — not an error, just skip.
      return;
    }

    const home = (lineups as LineupRow[]).find(
      (l) => l.team_id === args.homeTeamId,
    );
    const away = (lineups as LineupRow[]).find(
      (l) => l.team_id === args.awayTeamId,
    );
    if (!home || !away) return;

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
    };

    const engineTotals = computeMatchRunningTotalsViaEngine({
      homeTeamId: args.homeTeamId,
      awayTeamId: args.awayTeamId,
      games: args.games,
      pointsCalculator: args.pointsCalculator,
      pointsCalculatorParams: args.pointsCalculatorParams,
      winCondition: args.winCondition,
      thresholdInputs,
      homeThresholds: args.homeThresholds,
      awayThresholds: args.awayThresholds,
    });

    const { legacyTotals } = args;
    const diverged =
      engineTotals.home_games_won !== legacyTotals.home_games_won ||
      engineTotals.away_games_won !== legacyTotals.away_games_won ||
      pointsDiffer(engineTotals.home_points_earned, legacyTotals.home_points_earned) ||
      pointsDiffer(engineTotals.away_points_earned, legacyTotals.away_points_earned);

    if (diverged) {
      console.warn(
        '[shadowAudit] engine vs legacy DIVERGENCE',
        JSON.stringify({
          matchId: args.matchId,
          pointsCalculator: args.pointsCalculator,
          winCondition: args.winCondition,
          legacy: legacyTotals,
          engine: engineTotals,
        }),
      );
    }
  } catch (e) {
    // Never surface — the shadow must not perturb live scoring.
    console.warn(
      '[shadowAudit] audit failed (ignored)',
      e instanceof Error ? e.message : String(e),
    );
  }
}
