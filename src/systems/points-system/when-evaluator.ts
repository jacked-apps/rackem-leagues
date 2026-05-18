/**
 * @fileoverview WhenCondition evaluator — checks whether a WhenCondition's
 * firing semantics are currently true.
 *
 * Each WhenCondition kind has its own check logic. The runtime calls these
 * at the appropriate points during match evaluation:
 *  - After receipt-trigger resolution (at match start): check `receipt` kinds
 *  - After each game played: check `side_reaches`, `all_sides_reach`,
 *    `total_games_played` kinds
 *  - Once at match end: check `match_end` kinds
 *
 * Conditions reference thresholds by name; thresholdValues bag provides the
 * resolved values.
 *
 * @see ./types.ts — the WhenCondition variants
 */

import type { MatchStateBag, WhenCondition } from './types';

/**
 * Runtime context the WhenCondition evaluator needs to make a true/false
 * decision plus tell the caller WHICH side (if any) caused the firing.
 *
 * For per-side conditions like `side_reaches` with `side: 'any'`, the runtime
 * needs to know which side just crossed so subsequent action evaluation can
 * use `triggeringSide` in its target/value resolution.
 */
export interface WhenEvalResult {
  fires: boolean;
  /** Set when a per-side condition fires; null otherwise (`receipt`, `match_end`, etc.). */
  triggeringSide: 'home' | 'away' | null;
}

export interface WhenEvalContext {
  thresholdValues: Readonly<Record<string, number | null>>;
  /**
   * What phase of evaluation the runtime is in. Some condition kinds only
   * fire in specific phases (receipt during match-start; match_end at the end).
   */
  phase: 'receipt' | 'per_game' | 'match_end';
  /** For `per_game` phase: the side whose state just changed (won this game). */
  gameWinnerSide?: 'home' | 'away';
  /** For `per_game` phase: total games played including this one. */
  gamesPlayed?: number;
}

/**
 * Evaluate a WhenCondition. Returns fires + triggering side.
 *
 * Threshold references resolve via ctx.thresholdValues; missing references
 * throw (composition error). Variable references resolve via state.
 */
export function evaluateWhen(
  condition: WhenCondition,
  state: MatchStateBag,
  ctx: WhenEvalContext,
): WhenEvalResult {
  switch (condition.kind) {
    case 'receipt':
      return { fires: ctx.phase === 'receipt', triggeringSide: null };

    case 'match_end':
      return { fires: ctx.phase === 'match_end', triggeringSide: null };

    case 'total_games_played': {
      if (ctx.phase !== 'per_game' || ctx.gamesPlayed === undefined) {
        return { fires: false, triggeringSide: null };
      }
      const target = requireThreshold(ctx, condition.thresholdRef);
      return { fires: ctx.gamesPlayed === target, triggeringSide: null };
    }

    case 'side_reaches': {
      if (ctx.phase !== 'per_game') {
        return { fires: false, triggeringSide: null };
      }
      const target = requireThreshold(ctx, condition.thresholdRef);
      // Determine which side(s) to check.
      const sidesToCheck =
        condition.side === 'any' ? (['home', 'away'] as const) : [condition.side];
      for (const side of sidesToCheck) {
        // For "any" side firing, only check sides whose state actually changed
        // this game (avoids re-firing on stale state from prior games).
        if (condition.side === 'any' && ctx.gameWinnerSide !== side) continue;
        const varName = condition.sideVarTemplate.replace('<side>', side);
        const v = state[varName];
        if (typeof v === 'number' && v === target) {
          return { fires: true, triggeringSide: side };
        }
      }
      return { fires: false, triggeringSide: null };
    }

    case 'all_sides_reach': {
      if (ctx.phase !== 'per_game') {
        return { fires: false, triggeringSide: null };
      }
      const target = requireThreshold(ctx, condition.thresholdRef);
      const homeVar = condition.sideVarTemplate.replace('<side>', 'home');
      const awayVar = condition.sideVarTemplate.replace('<side>', 'away');
      const homeVal = state[homeVar];
      const awayVal = state[awayVar];
      const fires =
        typeof homeVal === 'number' &&
        typeof awayVal === 'number' &&
        homeVal === target &&
        awayVal === target;
      return { fires, triggeringSide: null };
    }
  }
}

/**
 * Get a threshold value as a number for comparison purposes. Throws if the
 * reference is undefined (composition error) OR if the value is null
 * (when-conditions reference thresholds as comparison values; null means
 * "no value applies" so any comparison would be meaningless — the
 * composition should not have wired a null-able threshold into a
 * when-condition that requires a value).
 */
function requireThreshold(ctx: WhenEvalContext, ref: string): number {
  const v = ctx.thresholdValues[ref];
  if (v === undefined) {
    throw new Error(`WhenCondition references undefined threshold "${ref}"`);
  }
  if (v === null) {
    throw new Error(
      `WhenCondition references null-valued threshold "${ref}"; only Action targets can accept null threshold values`,
    );
  }
  return v;
}
