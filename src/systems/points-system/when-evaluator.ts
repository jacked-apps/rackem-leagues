/**
 * @fileoverview WhenCondition evaluator — checks whether a WhenCondition's
 * firing semantics are currently true.
 *
 * Each WhenCondition kind has its own check logic. The runtime calls these
 * at the appropriate points during match evaluation:
 *  - At match start: `receipt` kinds
 *  - After each game played: `side_reaches`, `all_sides_reach`,
 *    `total_games_played`
 *  - Once at match end: `match_end`
 *
 * Conditions reference the trigger's bound input value (`n`) via the
 * `inputValue` field on the eval context — never a threshold name directly.
 *
 * @see ./types.ts — the WhenCondition variants
 */

import type { MatchStateBag, WhenCondition } from './types';

/**
 * Runtime context the WhenCondition evaluator needs to make a true/false
 * decision.
 *
 * - `inputValue` — the trigger's bound input value (`n`), resolved from the
 *   trigger's input threshold once per firing pass. Undefined if the trigger
 *   declared no input (only legal for receipt/match_end with no threshold read).
 * - `phase` — what phase of evaluation we're in; some kinds only fire in
 *   specific phases.
 * - `gameWinnerSide` — for `per_game` phase: which side won the current game.
 *   Used by `side_reaches` to gate firing to the side whose state just
 *   changed (prevents stale re-fires on subsequent games).
 * - `gamesPlayed` — for `per_game` phase: total games including this one.
 */
export interface WhenEvalContext {
  inputValue: number | null | undefined;
  phase: 'receipt' | 'per_game' | 'match_end';
  gameWinnerSide?: 'home' | 'away';
  gamesPlayed?: number;
}

/**
 * Evaluate a WhenCondition. Returns whether it fires this tick.
 */
export function evaluateWhen(
  condition: WhenCondition,
  state: MatchStateBag,
  ctx: WhenEvalContext,
): boolean {
  switch (condition.kind) {
    case 'receipt':
      return ctx.phase === 'receipt';

    case 'match_end':
      return ctx.phase === 'match_end';

    case 'total_games_played': {
      if (ctx.phase !== 'per_game' || ctx.gamesPlayed === undefined) return false;
      const n = requireInput(ctx);
      return ctx.gamesPlayed === n;
    }

    case 'side_reaches': {
      if (ctx.phase !== 'per_game') return false;
      // Only fire when the named side just won this game — prevents stale
      // re-firing on subsequent games when state[sideVar] hasn't changed.
      if (ctx.gameWinnerSide !== condition.side) return false;
      const n = requireInput(ctx);
      const v = state[condition.sideVar];
      return typeof v === 'number' && v === n;
    }

    case 'all_sides_reach': {
      if (ctx.phase !== 'per_game') return false;
      const n = requireInput(ctx);
      const homeVal = state[condition.homeVar];
      const awayVal = state[condition.awayVar];
      return (
        typeof homeVal === 'number' &&
        typeof awayVal === 'number' &&
        homeVal === n &&
        awayVal === n
      );
    }
  }
}

/**
 * Get the trigger's bound input value as a number. Throws if the trigger
 * declared no input (composition error — only receipt/match_end may omit
 * input, and they don't reach this helper) or if the input resolved to null
 * (WhenConditions compare against `n`, and a null `n` makes comparison
 * meaningless — the composition shouldn't wire a null-able threshold into
 * a comparison-using condition).
 */
function requireInput(ctx: WhenEvalContext): number {
  if (ctx.inputValue === undefined) {
    throw new Error(
      'WhenCondition requires the trigger to have an input, but none was declared',
    );
  }
  if (ctx.inputValue === null) {
    throw new Error(
      'WhenCondition references a null input value; only actions can accept null inputs',
    );
  }
  return ctx.inputValue;
}
