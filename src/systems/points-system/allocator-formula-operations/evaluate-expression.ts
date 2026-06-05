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
import type { AllocatorFormulaOperation, Expression } from '../types';

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
  compute: (args, _ctx, state) => {
    if (!isExpression(args.expression)) {
      console.warn(
        `evaluate_expression: args.expression is not a valid Expression tree; returning 0`,
      );
      return 0;
    }
    const result = evaluateExpression(args.expression, state);
    if (!result.ok) {
      console.warn(
        `evaluate_expression: ${result.reason}; returning 0`,
      );
      return 0;
    }
    return result.value;
  },
};

export function registerEvaluateExpression(): void {
  registerAllocatorFormulaOperation(evaluateExpressionOperation);
}

registerEvaluateExpression();
