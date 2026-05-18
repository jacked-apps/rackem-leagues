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
 *       (Triggers see the UPDATED state — wins counter already incremented,
 *       allocator increment already added — so a milestone trigger that
 *       fires "when home_wins reaches 9" runs AFTER the 9th win is counted.
 *       A jump_to action can then REPLACE the accumulated total to its jump value.)
 *
 * 3. **Match end phase.** Fire any `match_end`-kind triggers. Then, if a
 *    composition has an EndOfMatchAggregate, run it against the populated
 *    state to compute final home_points / away_points (overwriting whatever
 *    the per-game allocator + triggers accumulated — aggregate-mode is
 *    typically used INSTEAD of per-game accumulation, not in addition).
 *
 * Returns the final match-state bag.
 *
 * @see ./types.ts — PointsSystem composition shape
 * @see docs/brainstorms/2026-05-18-points-system-decomposition-requirements.md
 */

import { evaluateAction, type ActionContext } from './action-evaluator';
import { evaluateAllocator } from './allocator-evaluator';
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
 * Fire any triggers whose `when` becomes true in the given phase. Helper
 * factored out so the per-game / match_end / receipt phases all use the
 * same firing-and-action-evaluation logic.
 */
function fireTriggersForPhase(
  triggers: readonly Trigger[],
  state: MatchStateBag,
  whenCtx: WhenEvalContext,
): void {
  for (const trigger of triggers) {
    const whenResult = evaluateWhen(trigger.when, state, whenCtx);
    if (!whenResult.fires) continue;
    const actionCtx: ActionContext = {
      thresholdValues: whenCtx.thresholdValues,
      triggeringSide: whenResult.triggeringSide,
    };
    evaluateAction(trigger.action, state, actionCtx);
  }
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
  };

  // Phase 1: Receipt — resolve thresholds, then fire receipt triggers.
  const thresholdValues = resolveAllThresholds(
    composition.thresholds,
    thresholdInputs,
  );
  fireTriggersForPhase(composition.triggers, state, {
    thresholdValues,
    phase: 'receipt',
  });

  // Phase 2: Per-game.
  for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
    const game = games[gameIndex]!;

    // Capture cumulative state BEFORE this game (for allocator formulas).
    const cumulativeState = {
      home: {
        wins: (state.home_wins as number) ?? 0,
        points: (state.home_points as number) ?? 0,
      },
      away: {
        wins: (state.away_wins as number) ?? 0,
        points: (state.away_points as number) ?? 0,
      },
    };

    // Increment wins for the winning side.
    const winnerKey = `${game.winnerSide}_wins`;
    state[winnerKey] = ((state[winnerKey] as number) ?? 0) + 1;

    // Run per-game allocator if present; add contributions to per-side points.
    if (composition.perGameAllocator) {
      const allocation = evaluateAllocator(
        composition.perGameAllocator,
        {
          winnerSide: game.winnerSide,
          winnerCounterInput: game.winnerCounterInput,
          loserCounterInput: game.loserCounterInput,
        },
        cumulativeState,
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

    // Fire per-game triggers whose conditions now hold (state already updated).
    fireTriggersForPhase(composition.triggers, state, {
      thresholdValues,
      phase: 'per_game',
      gameWinnerSide: game.winnerSide,
      gamesPlayed: gameIndex + 1,
    });
  }

  // Phase 3: Match end. Fire any match_end triggers, then run the aggregate
  // if present (the aggregate OVERWRITES home_points/away_points — typical
  // for aggregate-mode Scoring Systems that don't use per-game accumulation).
  fireTriggersForPhase(composition.triggers, state, {
    thresholdValues,
    phase: 'match_end',
  });

  if (composition.endOfMatchAggregate) {
    const aggregateInput = {
      homeWins: (state.home_wins as number) ?? 0,
      awayWins: (state.away_wins as number) ?? 0,
      homeWinTarget: requireNumber(state, 'homeWinTarget'),
      awayWinTarget: requireNumber(state, 'awayWinTarget'),
      homeTieTarget: nullableNumber(state, 'homeTieTarget'),
      awayTieTarget: nullableNumber(state, 'awayTieTarget'),
      homeLoseTarget: requireNumber(state, 'homeLoseTarget'),
      awayLoseTarget: requireNumber(state, 'awayLoseTarget'),
    };
    const result = composition.endOfMatchAggregate.compute(
      aggregateInput,
      composition.endOfMatchAggregate.params,
    );
    state.home_points = result.homePoints;
    state.away_points = result.awayPoints;
  }

  return state;
}

function requireNumber(state: MatchStateBag, key: string): number {
  const v = state[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(
      `evaluatePointsSystem: end-of-match aggregate requires numeric variable "${key}", got ${JSON.stringify(v)}`,
    );
  }
  return v;
}

function nullableNumber(state: MatchStateBag, key: string): number | null {
  const v = state[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(
      `evaluatePointsSystem: aggregate variable "${key}" must be a number or null, got ${JSON.stringify(v)}`,
    );
  }
  return v;
}
