/**
 * @fileoverview The metric-stack walker.
 *
 * The walker is the core algorithm of the Win Calculator Module. Given an ordered metric
 * precedence stack and the match's data, it walks the stack in order and returns the first
 * `WinnerDecision` produced by a metric whose values differ between the two teams.
 *
 * If the walker exhausts the stack without finding a metric on which the teams differ, it
 * returns `'tied'`. Two paths reach this outcome:
 *   1. The stack does NOT include an `edge` entry, and all metrics tied — match stands as tied.
 *   2. The stack includes an `edge` entry that the walker reaches — Unit 9 will wire this to
 *      fire the Tiebreak System. In Unit 1, the walker's defensive fallback treats `edge` as
 *      a no-op (returns 'tied'). This branch is unreachable in shipped code in Unit 1 because
 *      no league's stack contains `edge` yet.
 *
 * @see ./types.ts — the type definitions
 * @see docs/league-system/modules/win-calculator.md — the locked Win Calculator blueprint
 */

import type { MatchData, MetricStackEntry, WinnerDecision } from './types';

/**
 * Walk the metric stack and decide the match winner.
 *
 * For each entry in the stack, in order:
 *   - Read the two teams' values for that metric.
 *   - If they differ, return the team with the higher value as the winner.
 *   - If they're equal, continue to the next entry.
 *
 * If the loop exhausts the stack without returning, the match is tied. See file header
 * for the two paths that reach this outcome.
 *
 * @param stack The ordered metric precedence stack from the active Win Calculator Module.
 * @param data The match's accumulated game-wins + points totals for both teams.
 * @returns A `WinnerDecision`: 'home_win', 'away_win', or 'tied'.
 *
 * @example
 *   // Games-based win condition, home team won 12-6:
 *   walkMetricStack([{ kind: 'games_won' }], { home_games_won: 12, away_games_won: 6, home_points: 0, away_points: 0 });
 *   // → 'home_win'
 *
 * @example
 *   // Points-based win condition, away team accumulated more points:
 *   walkMetricStack([{ kind: 'points_earned' }], { home_games_won: 9, away_games_won: 9, home_points: 45, away_points: 52 });
 *   // → 'away_win'
 *
 * @example
 *   // Tied at the only metric, no edge fallback:
 *   walkMetricStack([{ kind: 'games_won' }], { home_games_won: 9, away_games_won: 9, home_points: 0, away_points: 0 });
 *   // → 'tied'
 */
export function walkMetricStack(
  stack: ReadonlyArray<MetricStackEntry>,
  data: MatchData,
): WinnerDecision {
  for (const entry of stack) {
    switch (entry.kind) {
      case 'games_won': {
        if (data.home_games_won > data.away_games_won) return 'home_win';
        if (data.away_games_won > data.home_games_won) return 'away_win';
        // Equal: fall through to next entry.
        break;
      }
      case 'points_earned': {
        if (data.home_points > data.away_points) return 'home_win';
        if (data.away_points > data.home_points) return 'away_win';
        // Equal: fall through to next entry.
        break;
      }
      case 'edge': {
        // Unit 1 defensive fallback: `edge` evaluation is not wired yet (Unit 9 will).
        // In Unit 1 no league's stack contains `edge`, so this branch is unreachable in
        // shipped code. When the runtime accidentally provides an `edge` entry, treat it
        // as a no-op and fall through. The final `return 'tied'` will then run.
        //
        // When Unit 9 wires the Tiebreak System, this branch will fire the trigger,
        // receive an edge metric value, and return the winning team based on it.
        break;
      }
    }
  }
  return 'tied';
}
