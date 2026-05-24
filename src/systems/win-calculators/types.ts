/**
 * @fileoverview Win Calculator Module — metric precedence stack interface.
 *
 * Per the locked Win Calculator blueprint (docs/league-system/modules/win-calculator.md),
 * Win Calculator walks a configurable metric precedence stack to decide the match winner.
 * The walker compares each metric in order; the first metric on which the two teams differ
 * decides. If the walker reaches an `edge` entry (all higher-precedence metrics having tied),
 * it fires the Tiebreak System (a future Module) to produce edge's value.
 *
 * **Unit 1 scope discipline** (from `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`):
 * the metric-stack interface is implemented here, but every league's actual stack contains
 * exactly ONE entry — the one corresponding to today's `win_condition` preference value.
 * Multi-entry stacks, the `edge` entry's evaluation, and the Tiebreak System trigger
 * integration are all enabled by the interface but NOT implemented in this Unit. They
 * land in Unit 9 (Tiebreak System extraction) and beyond.
 *
 * @see docs/league-system/modules/win-calculator.md — the locked blueprint
 * @see docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md — Unit 1
 */

/**
 * A single entry in the metric precedence stack.
 *
 * The walker compares the two teams' values for this metric. If they differ, that team wins.
 * If they're equal, the walker moves to the next entry.
 *
 * - `'games_won'` — compare per-team game-win counts; higher wins
 * - `'points_earned'` — compare per-team accumulated points; higher wins
 * - `'edge'` — fire the Tiebreak System (when wired in Unit 9) to produce a deciding value.
 *   In Unit 1 this entry is enabled by the type system but never appears in any league's
 *   stack; the walker treats reaching `edge` as the "tied" outcome (defensive fallback).
 */
export type MetricStackEntry =
  | { kind: 'games_won' }
  | { kind: 'points_earned' }
  | { kind: 'edge' };

/**
 * The decision returned by the walker after evaluating the metric stack.
 *
 * - `'home_win'` / `'away_win'` — a metric in the stack determined the winner
 * - `'tied'` — the walker exhausted the stack without producing a winner. Two ways this
 *   can happen:
 *   1. The stack contained no `edge` entry, and all metrics tied → the match stands as tied
 *      (this is the "accept-tie" semantics from the locked blueprint).
 *   2. The walker reached an `edge` entry but Unit 1's defensive fallback treats it as
 *      tied (since Tiebreak System isn't wired yet). In shipped code this doesn't happen
 *      because no league's stack includes `edge` in Unit 1.
 */
export type WinnerDecision = 'home_win' | 'away_win' | 'tied';

/**
 * Match data the walker reads to evaluate each metric.
 *
 * Both teams' game-win counts AND points are passed in regardless of which metric the stack
 * uses — the walker reads only what each entry requires. This shape matches what consumers
 * already accumulate during match scoring; no new data collection needed.
 */
export interface MatchData {
  home_games_won: number;
  away_games_won: number;
  home_points: number;
  away_points: number;
}

/**
 * The Win Calculator Module.
 *
 * Composed by the resolver (`buildSystemFromPreferences`) from the league's `win_condition`
 * preference. The runtime calls `decide(matchData)` at match-end time to determine the
 * match winner; it does NOT branch on `win_condition` directly anymore.
 */
export interface WinCalculator {
  /**
   * The LO-configured metric precedence stack. Walked in order by `decide`.
   *
   * In Unit 1, every league's stack has exactly ONE entry (matching `win_condition`).
   * Future units may populate multi-entry stacks (e.g., `[games_won, points_earned, edge]`).
   */
  readonly metricStack: ReadonlyArray<MetricStackEntry>;

  /**
   * Walk the metric stack and decide the match winner.
   *
   * Pure function: same inputs always produce the same `WinnerDecision`. No state, no
   * side effects, no DB access. Safe to call from anywhere that has match data.
   */
  decide: (data: MatchData) => WinnerDecision;
}
