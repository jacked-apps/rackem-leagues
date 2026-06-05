/**
 * @fileoverview Allocator-formula operation: `evaluate_expression`.
 *
 * Evaluates an arbitrary `Expression` tree (the same shape triggers use)
 * against the shared match-state bag and returns the resulting number.
 * This is the recipe the workshop's click-to-build formula UI writes
 * into — it lets users compose `(home_wins + 2)` or
 * `(home_wins - away_wins) × 0.5` style expressions without ever typing
 * a state variable name (the UI offers them via a curated list).
 *
 * Reuses the existing trigger-side `evaluateExpression` so the math
 * surface is identical to what triggers already do — same operators,
 * same state-var resolution, same divide-by-zero guard.
 *
 * **Arg shape:** declared on the operation; the workshop's UI fills it.
 *   - `expression: Expression` — the expression tree to evaluate.
 *
 * **Missing or non-numeric state**, or divide-by-zero, returns `0` and
 * console.warns. The runtime backstop (Unit 4) is the last-line guard
 * against any unexpected throw; this recipe is structured not to need
 * it.
 */

import { registerAllocatorFormulaOperation } from '../allocator-formula-registry';
import { evaluateExpression } from '../expression-evaluator';
import type {
  AllocatorFormulaOperation,
  Expression,
  FormulaContext,
  MatchStateBag,
} from '../types';

/**
 * Map of virtual, side-agnostic var names to their real state-bag names
 * given the current per-game allocation context. The workshop's
 * "available data" list exposes these virtual names so an LO can write
 * formulas like "this side's wins" without typing home_wins / away_wins
 * (which would be unfair when the winner this game isn't the home team).
 *
 * Resolution rule: `this_side` maps to whichever real team this formula
 * is computing for THIS GAME. When computing the WINNER side's formula,
 * `this_side` is the game's winner (home or away). When computing the
 * LOSER side's formula, `this_side` is the game's loser. `other_side` is
 * always the opposite.
 */
function virtualNameMap(ctx: FormulaContext): Record<string, string> {
  const winnerTeam = ctx.winnerSide;
  const loserTeam: 'home' | 'away' = winnerTeam === 'home' ? 'away' : 'home';
  const thisTeam = ctx.thisSide === 'winner' ? winnerTeam : loserTeam;
  const otherTeam: 'home' | 'away' = thisTeam === 'home' ? 'away' : 'home';
  return {
    this_side_wins: `${thisTeam}_wins`,
    other_side_wins: `${otherTeam}_wins`,
    this_side_points: `${thisTeam}_points`,
    other_side_points: `${otherTeam}_points`,
  };
}

/**
 * Build a read-only state proxy that resolves virtual side-agnostic var
 * names to their real state-bag entries, falling back to the raw state
 * for any other name (so non-virtual reads still work).
 */
function buildResolvingState(
  state: Readonly<MatchStateBag>,
  ctx: FormulaContext,
): Readonly<MatchStateBag> {
  const aliases = virtualNameMap(ctx);
  return new Proxy(state as MatchStateBag, {
    get(target, prop: string) {
      if (typeof prop !== 'string') return undefined;
      if (prop in aliases) return target[aliases[prop] as keyof typeof target];
      return target[prop as keyof typeof target];
    },
    has(target, prop: string) {
      if (typeof prop !== 'string') return false;
      if (prop in aliases) return aliases[prop] in target;
      return prop in target;
    },
  });
}

function isExpression(value: unknown): value is Expression {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { kind?: unknown };
  return v.kind === 'const' || v.kind === 'var' || v.kind === 'op';
}

export const evaluateExpressionOperation: AllocatorFormulaOperation = {
  name: 'evaluate_expression',
  // No argsShape declared — the `expression` arg is a tree, not one of
  // the simple ArgKinds the validator checks structurally. Shape-safety
  // for the expression itself comes from the workshop's token builder
  // (which can only emit valid trees) plus the runtime evaluator's
  // never-throw discipline.
  compute: (args, ctx, state) => {
    if (!isExpression(args.expression)) {
      console.warn(
        `evaluate_expression: args.expression is not a valid Expression tree; returning 0`,
      );
      return 0;
    }
    // Wrap state so virtual side-agnostic names resolve to the right
    // home_*/away_* entry based on which side this game's formula is
    // computing for.
    const resolved = buildResolvingState(state, ctx);
    const result = evaluateExpression(args.expression, resolved);
    if (!result.ok) {
      console.warn(`evaluate_expression: ${result.reason}; returning 0`);
      return 0;
    }
    return result.value;
  },
};

export function registerEvaluateExpression(): void {
  registerAllocatorFormulaOperation(evaluateExpressionOperation);
}

registerEvaluateExpression();
