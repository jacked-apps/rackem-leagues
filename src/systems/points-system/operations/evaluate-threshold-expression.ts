/**
 * @fileoverview Threshold operation: `evaluate_expression` (formula view).
 *
 * Unit 2 of the Threshold Workshop plan
 * (`docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md`).
 *
 * The formula half of the threshold lookup-side fork. Evaluates an arbitrary
 * `Expression` tree (the same shape triggers + the allocator use) against the
 * runtime `ThresholdInputs`, viewed through side-agnostic `this_side` /
 * `other_side` virtuals. This is what the workshop's shared `ExpressionBuilder`
 * writes into — the LO composes `(this_side_team_handicap - other_side_team_handicap)`
 * style formulas without ever typing a real input name.
 *
 * **The mirror, generalized.** The binding's side (`args.side`) decides which
 * real input each virtual resolves to: for `side='home'`, `this_side_*` reads
 * the home inputs; for `side='away'`, it reads the away inputs — the same
 * formula produces a value and its mirror. A side-less (`single`) threshold
 * needs no `side`; perspective-free formulas (e.g. `round(game_count * 0.75)`)
 * read only neutral virtuals.
 *
 * **Arg shape (filled by the workshop UI):**
 *   - `expression: Expression` — the tree to evaluate.
 *   - `side?: 'home' | 'away'` — the active binding's perspective (the future
 *     fan-out supplies this per expansion binding; absent ⇒ home perspective,
 *     harmless for side-less formulas that reference no `this_side_*` virtual).
 *
 * **Never throws.** A non-Expression arg, a missing/non-numeric virtual, or a
 * divide-by-zero returns `null` + console.warn (the threshold resolves to
 * `null` in the bag — "no value applies"), reusing the trigger evaluator's
 * never-break discipline.
 *
 * Encoding-agnostic by declaration: `consumesHandicapType: 'none'` (the formula
 * references generic virtuals, not a specific encoding) and
 * `consumesSize: { lineup_sizes: 'any' }` (size-agnostic — formulas scale).
 *
 * @see ../expression-evaluator.ts — the shared never-throw evaluator
 * @see ./chart-lookup-3v3.ts — the registration pattern this mirrors
 */

import { evaluateExpression } from '../expression-evaluator';
import { registerThresholdOperation } from '../threshold-registry';
import type {
  Expression,
  MatchStateBag,
  ThresholdInputs,
  ThresholdOperation,
  ThresholdOutputSide,
} from '../types';

function isExpression(value: unknown): value is Expression {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { kind?: unknown };
  return v.kind === 'const' || v.kind === 'var' || v.kind === 'op';
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, n) => acc + n, 0);
}

/**
 * Build the flat name→number map the expression reads from. `this_side` is the
 * perspective the active binding is computing for; `other_side` is the opposite.
 * Optional inputs default to 0 so a formula referencing them resolves rather
 * than failing on a missing var.
 */
function buildThresholdState(
  inputs: ThresholdInputs,
  side: 'home' | 'away',
): MatchStateBag {
  const thisIsHome = side === 'home';
  const thisRatings = thisIsHome ? inputs.homeRatings : inputs.awayRatings;
  const otherRatings = thisIsHome ? inputs.awayRatings : inputs.homeRatings;
  const thisDiff = thisIsHome ? inputs.homeHandicapDiff : inputs.awayHandicapDiff;
  const otherDiff = thisIsHome ? inputs.awayHandicapDiff : inputs.homeHandicapDiff;
  const thisTeamHc = (thisIsHome ? inputs.homeTeamHandicap : inputs.awayTeamHandicap) ?? 0;
  const otherTeamHc = (thisIsHome ? inputs.awayTeamHandicap : inputs.homeTeamHandicap) ?? 0;

  const state: Record<string, number> = {
    this_side_handicap_diff: thisDiff,
    other_side_handicap_diff: otherDiff,
    this_side_team_handicap: thisTeamHc,
    other_side_team_handicap: otherTeamHc,
    this_side_rating_sum: sum(thisRatings),
    other_side_rating_sum: sum(otherRatings),
    game_count: inputs.gameCount,
  };
  return state as unknown as MatchStateBag;
}

export const evaluateThresholdExpressionOperation: ThresholdOperation = {
  name: 'evaluate_expression',
  // Encoding-agnostic: the formula reads generic virtuals, not a specific
  // handicap encoding.
  consumesHandicapType: 'none',
  // Size-agnostic — a formula scales with whatever ratings/diffs it reads.
  consumesSize: { kind: 'lineup_sizes', sizes: 'any' },
  producesOutputType: 'numeric',
  // Output side follows the active binding: a sided binding produces that
  // side's value; absent ⇒ a shared (side-less) value.
  producesOutputSide: (args): ThresholdOutputSide => {
    const side = args.side;
    if (side === 'home' || side === 'away') return side;
    return 'shared';
  },
  producesOutputRange: { min: 'unbounded', max: 'unbounded' },
  compute: (args, inputs) => {
    if (!isExpression(args.expression)) {
      console.warn(
        `evaluate_expression (threshold): args.expression is not a valid Expression tree; returning null`,
      );
      return null;
    }
    const side = args.side === 'away' ? 'away' : 'home';
    const state = buildThresholdState(inputs, side);
    const result = evaluateExpression(args.expression, state);
    if (!result.ok) {
      console.warn(`evaluate_expression (threshold): ${result.reason}; returning null`);
      return null;
    }
    return result.value;
  },
};

/**
 * Side-effect: register the operation in the threshold registry at module load
 * time. Importing this file makes `'evaluate_expression'` available for
 * `ThresholdRow.operationKind` references.
 */
export function registerEvaluateThresholdExpression(): void {
  registerThresholdOperation(evaluateThresholdExpressionOperation);
}

registerEvaluateThresholdExpression();
