/**
 * @fileoverview Points System runtime evaluator.
 *
 * Walks a complete PointsSystem composition over a sequence of games,
 * producing the final per-side per-match points (and any other variables
 * triggers wrote to the match-state bag).
 *
 * **Three phases per match:**
 *
 * 1. **Receipt phase (match start).** Resolve all thresholds. Initialize
 *    per-side variables (home_wins / away_wins / home_points / away_points = 0).
 *    Fire all `receipt`-kind triggers in composition order. Receipt triggers
 *    do work like "assign threshold value to a variable" (chart targets,
 *    initial points, etc.).
 *
 * 2. **Per-game phase.** For each stored game record (in chronological order):
 *    a. Capture cumulative match-state BEFORE this game (for allocator formula context)
 *    b. Increment the winning side's `*_wins` variable
 *    c. If a per-game allocator is configured, run it; add winner_contribution
 *       to the winner side's points variable, loser_contribution to the loser's
 *    d. Fire any per_game-phase triggers whose `when` becomes true.
 *
 * 3. **Match end phase.** Fire any `match_end`-kind triggers. Then, if a
 *    composition has an EndOfMatchAggregate, run it against the populated
 *    state to compute final home_points / away_points.
 *
 * **Terminal triggers halt the cascade.** When a trigger with `terminal: true`
 * fires, no more triggers are evaluated for the remainder of the match (the
 * cascade is over). The aggregate (if present) still runs — terminal halts
 * TRIGGERS, but it's the signal to "initiate end-of-match protocols."
 *
 * **Trigger input resolution.** Each trigger declares `input.thresholdRef`
 * (optional for receipt/match_end). The runtime resolves it to the threshold's
 * value (`n`) once per firing pass; `n` is then passed to both the when
 * predicate and the action evaluator. Triggers reference EXACTLY ONE
 * threshold — no mix-and-match.
 *
 * @see ./types.ts — PointsSystem composition shape
 * @see docs/brainstorms/2026-05-18-points-system-decomposition-requirements.md
 */

import { evaluateAction, type ActionContext } from './action-evaluator';
import { evaluateAllocator } from './allocator-evaluator';
import { getAggregateOperation } from './aggregate-registry';
import { evaluateWhen, type WhenEvalContext } from './when-evaluator';
import { resolveAllThresholds } from './threshold-helpers';
import type {
  MatchStateBag,
  PointsSystem,
  ThresholdInputs,
  Trigger,
} from './types';

/**
 * Per-game record fed to the runtime. Mirrors AllocatorGameRecord with the
 * addition that the runtime only requires the winnerSide here; counter
 * inputs only matter if the composition has a per-game allocator with
 * counter-kind sides.
 */
export interface RuntimeGameRecord {
  winnerSide: 'home' | 'away';
  winnerCounterInput: number | null;
  loserCounterInput: number | null;
}

/**
 * Final result of a points-system evaluation: the populated match-state bag.
 * Callers typically read `home_points` / `away_points` for the per-match
 * totals, but any other variables the composition wrote (chips, signals,
 * chart values for display, etc.) are also available.
 */
export type RuntimeResult = MatchStateBag;

/**
 * Phase-shared inputs the runtime gathers once per phase pass.
 */
interface PhaseInputs {
  thresholdValues: Readonly<Record<string, number | null>>;
  phase: 'receipt' | 'per_game' | 'match_end';
  gameWinnerSide?: 'home' | 'away';
  gamesPlayed?: number;
}

/**
 * Fire any triggers whose `when` becomes true in the given phase. For each
 * trigger, the trigger's bound input value (`n`) is resolved from
 * `thresholdValues` and passed to both the when predicate and the action
 * evaluator. Returns `true` if a terminal trigger fired (caller halts).
 */
function fireTriggersForPhase(
  triggers: readonly Trigger[],
  state: MatchStateBag,
  inputs: PhaseInputs,
): boolean {
  for (const trigger of triggers) {
    // Resolve the trigger's bound input value once; same value flows into
    // both the when predicate (as `n`) and the action evaluator (as input_ref).
    // `null` is a valid resolved value (operation returned "no value applies");
    // only `undefined` (threshold name not in the map) is a composition error.
    let inputValue: number | null | undefined;
    if (trigger.input) {
      const v = inputs.thresholdValues[trigger.input.thresholdRef];
      if (v === undefined) {
        throw new Error(
          `Trigger "${trigger.name}" references undefined threshold "${trigger.input.thresholdRef}"`,
        );
      }
      inputValue = v;
    } else {
      inputValue = undefined;
    }

    const whenCtx: WhenEvalContext = {
      inputValue,
      phase: inputs.phase,
      gameWinnerSide: inputs.gameWinnerSide,
      gamesPlayed: inputs.gamesPlayed,
    };
    if (!evaluateWhen(trigger.when, state, whenCtx)) continue;

    const actionCtx: ActionContext = { inputValue };
    evaluateAction(trigger.action, state, actionCtx);

    if (trigger.terminal) return true;
  }
  return false;
}

/**
 * Evaluate a PointsSystem composition over a match.
 *
 * @param composition The Points System (named thresholds, optional allocator, triggers, optional aggregate)
 * @param thresholdInputs Inputs for threshold resolution at match start (lineups, prefs, etc.)
 * @param games Per-game records in chronological order
 * @returns Final match-state bag with home_points/away_points and any other written variables
 */
export function evaluatePointsSystem(
  composition: PointsSystem,
  thresholdInputs: ThresholdInputs,
  games: readonly RuntimeGameRecord[],
): RuntimeResult {
  const state: MatchStateBag = {
    home_wins: 0,
    away_wins: 0,
    home_points: 0,
    away_points: 0,
    // Match-level state exposed to allocator formulas + triggers via the
    // universal state bag (per the locked Composability principle). Set at
    // match start from Team Geometry's gameCount.
    games_played: 0,
    total_games: thresholdInputs.gameCount,
  };

  // Resolve all thresholds once at match start.
  const thresholdValues = resolveAllThresholds(
    composition.thresholds,
    thresholdInputs,
  );

  // Thresholds are state setters (locked Trigger model): each resolved value is
  // written into the state bag under its name at match start, before any trigger
  // fires. Consumers (triggers, the end-of-match scoring pattern) read these by
  // name from the bag — "thresholds resolve → then triggers fire."
  for (const [name, value] of Object.entries(thresholdValues)) {
    state[name] = value;
  }

  // Phase 1: Receipt — fire receipt triggers.
  let halted = fireTriggersForPhase(composition.triggers, state, {
    thresholdValues,
    phase: 'receipt',
  });

  // Phase 2: Per-game. Skip remaining games if a terminal already fired
  // (rare for receipt, but the cascade contract is uniform across phases).
  for (let gameIndex = 0; gameIndex < games.length && !halted; gameIndex++) {
    const game = games[gameIndex]!;

    // Increment wins for the winning side BEFORE the allocator runs — the
    // allocator's formulas read state.<side>_wins and should see the
    // already-incremented value for the side that just won.
    const winnerKey = `${game.winnerSide}_wins`;
    state[winnerKey] = ((state[winnerKey] as number) ?? 0) + 1;

    // Run per-game allocator if present; add contributions to per-side points.
    // The allocator reads the state bag directly (formulas may reference any
    // state var — home_wins, games_played, total_games, etc.).
    if (composition.perGameAllocator) {
      const allocation = evaluateAllocator(
        composition.perGameAllocator,
        {
          winnerSide: game.winnerSide,
          winnerCounterInput: game.winnerCounterInput,
          loserCounterInput: game.loserCounterInput,
        },
        state,
      );
      const loserSide: 'home' | 'away' =
        game.winnerSide === 'home' ? 'away' : 'home';
      const winnerPointsKey = `${game.winnerSide}_points`;
      const loserPointsKey = `${loserSide}_points`;
      state[winnerPointsKey] =
        ((state[winnerPointsKey] as number) ?? 0) + allocation.winnerContribution;
      state[loserPointsKey] =
        ((state[loserPointsKey] as number) ?? 0) + allocation.loserContribution;
    }

    // Increment games_played so per-game triggers + future formulas see
    // the post-game state ("this is game N completed").
    state.games_played = ((state.games_played as number) ?? 0) + 1;

    // Fire per-game triggers whose conditions now hold (state already updated).
    halted = fireTriggersForPhase(composition.triggers, state, {
      thresholdValues,
      phase: 'per_game',
      gameWinnerSide: game.winnerSide,
      gamesPlayed: gameIndex + 1,
    });
  }

  // Phase 3: Match end. Skip triggers if a terminal already fired (cascade
  // ended early); aggregate still runs as the "end-of-match protocol."
  if (!halted) {
    fireTriggersForPhase(composition.triggers, state, {
      thresholdValues,
      phase: 'match_end',
    });
  }

  if (composition.endOfMatchAggregate) {
    // Aggregate operation reads the state bag directly (home_wins, away_wins,
    // and the chart-target state vars receipt triggers populated). It
    // OVERWRITES home_points/away_points — aggregate-mode is an alternative
    // to per-game accumulation, not additive.
    const operation = getAggregateOperation(
      composition.endOfMatchAggregate.operationKind,
    );
    if (operation === undefined) {
      throw new Error(
        `evaluatePointsSystem: unknown aggregate operation "${composition.endOfMatchAggregate.operationKind}"`,
      );
    }
    const result = operation.compute(
      composition.endOfMatchAggregate.operationArgs,
      state,
    );
    state.home_points = result.homePoints;
    state.away_points = result.awayPoints;
  }

  return state;
}
