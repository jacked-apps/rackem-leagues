/**
 * @fileoverview Win Calculator — the judge (`decideWinner`).
 *
 * The pure judge that names a winner (or concludes a tie) at match end. It does
 * exactly three things, in order:
 *   1. **Winner chip override** — if `edge` is already set in the state, that
 *      side won (a clinch, a prior comparator, or the Tiebreak System wrote it).
 *      The comparators do not run.
 *   2. **Walk the comparators** — in the LO's configured order, dispatch each
 *      enabled metric to its mode (`most` / `met_goal`). The first comparator
 *      that names a winner decides.
 *   3. **No winner → tie** — if none decides, the verdict is a tie. The judge
 *      hands that up; what becomes of a tie (break it / let it stand) is the
 *      runtime's call, not this module's.
 *
 * Never-break: the judge never throws. Each comparator call is wrapped; on any
 * error it is treated as "no decision" and the error is recorded. Anomalies a
 * comparator surfaces (e.g. both sides met their target) are likewise recorded.
 * All such notes are returned in `flags` for the runtime to route — they never
 * block the verdict.
 *
 * Canonical model: `docs/league-system/modules/win-calculator.md`.
 */

import type { ComparatorMode, Verdict, WinCalcConfig, WinCalcState } from './types';
import { metGoal, most, type ComparatorOutcome } from './comparators';

/**
 * The judge's output: the verdict, plus any anomalies/errors surfaced while
 * judging. `flags` is empty in the normal case; non-empty entries are for the
 * runtime to log / notify / record (a future hook-up) — they do not affect the
 * verdict.
 */
export interface WinCalcResult {
  readonly verdict: Verdict;
  readonly flags: ReadonlyArray<string>;
}

/** Run one metric's comparator against the state, per the configured mode. */
function runComparator(
  metric: 'games' | 'points',
  mode: ComparatorMode,
  state: WinCalcState,
): ComparatorOutcome {
  if (metric === 'games') {
    return mode === 'most'
      ? most(state.home_games, state.away_games)
      : metGoal(state.home_games, state.home_games_target, state.away_games, state.away_games_target);
  }
  return mode === 'most'
    ? most(state.home_points, state.away_points)
    : metGoal(state.home_points, state.home_points_target, state.away_points, state.away_points_target);
}

/**
 * Decide the match winner. Pure and never-throwing.
 *
 * @param state  the slice of shared match state to judge
 * @param config the LO-assigned dials (which comparators, modes, order)
 * @returns the verdict (`{ winner }` or `{ tie: true }`) plus any surfaced flags
 */
export function decideWinner(state: WinCalcState, config: WinCalcConfig): WinCalcResult {
  const flags: string[] = [];

  // 1. Winner chip — unconditional override, checked first.
  if (state.edge === 'home' || state.edge === 'away') {
    return { verdict: { winner: state.edge }, flags };
  }

  // 2. Walk the enabled comparators in the LO's order.
  for (const metric of config.order) {
    const mode = config[metric]?.mode;
    if (mode === undefined) {
      flags.push(`${metric}: listed in order but has no mode configured — skipped`);
      continue;
    }

    let outcome: ComparatorOutcome;
    try {
      outcome = runComparator(metric, mode, state);
    } catch (err) {
      // Never-break: a misbehaving comparator is treated as "no decision".
      flags.push(`${metric} comparator threw — treated as no decision: ${String(err)}`);
      continue;
    }

    if (outcome.winner !== null) {
      return { verdict: { winner: outcome.winner }, flags };
    }
    if (outcome.anomaly !== undefined) {
      flags.push(`${metric}: ${outcome.anomaly}`);
    }
  }

  // 3. No comparator named a winner → tie (a residue handed to the runtime).
  return { verdict: { tie: true }, flags };
}
