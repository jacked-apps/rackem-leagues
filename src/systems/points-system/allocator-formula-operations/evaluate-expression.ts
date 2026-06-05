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
 * Two kinds of virtual, side-agnostic data the workshop's expression
 * builder can reference:
 *
 *   1. **State-bag aliases** — `this_side_wins` → real state-bag entry
 *      like `home_wins` / `away_wins` based on which team this side
 *      represents THIS game. `this_side_points` / `other_side_points` /
 *      `other_side_wins` likewise.
 *   2. **Per-game role injections** — `this_side_value` /
 *      `other_side_value` resolve to direct numbers off the FormulaContext:
 *      the resolved BASE value for this game's role (winner or loser).
 *      Lets an LO express formulas like 17-Point's
 *      `(this_side_value + (7 - other_side_value))` without referencing
 *      ctx directly.
 *
 * Resolution rule: `this_side` is always the role/team this formula is
 * computing for. When computing the WINNER side, `this_side` is the
 * game's winner (and their team). When computing the LOSER side,
 * `this_side` is the game's loser. `other_side` is always the opposite.
 */
function virtualStateAliases(ctx: FormulaContext): Record<string, string> {
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

function virtualCtxValues(ctx: FormulaContext): Record<string, number> {
  const thisValue = ctx.thisSide === 'winner' ? ctx.winner : ctx.loser;
  const otherValue = ctx.thisSide === 'winner' ? ctx.loser : ctx.winner;
  // Handicaps are optional on FormulaContext — callers (tests, synthetic
  // dry-runs) may omit them. Fall back to 0 with the wider name available
  // so formulas referencing them don't crash; the runtime backstop (Unit
  // 4) would catch any throw anyway. A `??` here makes "absent" behave
  // the same as 0.
  const winnerHc = typeof ctx.winnerHandicap === 'number' ? ctx.winnerHandicap : 0;
  const loserHc = typeof ctx.loserHandicap === 'number' ? ctx.loserHandicap : 0;
  const thisHc = ctx.thisSide === 'winner' ? winnerHc : loserHc;
  const otherHc = ctx.thisSide === 'winner' ? loserHc : winnerHc;
  return {
    this_side_value: thisValue,
    other_side_value: otherValue,
    this_side_handicap: thisHc,
    other_side_handicap: otherHc,
  };
}

/**
 * Build a read-only state proxy that resolves virtual side-agnostic var
 * names to their real state-bag entries OR direct per-game values from
 * ctx, falling back to the raw state for any other name.
 */
function buildResolvingState(
  state: Readonly<MatchStateBag>,
  ctx: FormulaContext,
): Readonly<MatchStateBag> {
  const aliases = virtualStateAliases(ctx);
  const ctxValues = virtualCtxValues(ctx);
  return new Proxy(state as MatchStateBag, {
    get(target, prop: string) {
      if (typeof prop !== 'string') return undefined;
      if (prop in ctxValues) return ctxValues[prop];
      if (prop in aliases) return target[aliases[prop] as keyof typeof target];
      return target[prop as keyof typeof target];
    },
    has(target, prop: string) {
      if (typeof prop !== 'string') return false;
      if (prop in ctxValues) return true;
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
