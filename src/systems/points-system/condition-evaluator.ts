/**
 * @fileoverview Trigger CONDITION evaluator — the "if" check.
 *
 * A trigger's CONDITION is ONE flat comparison between state vars and/or
 * constants, or the explicit `always` (the locked Trigger model, `trigger.md` —
 * "CONDITION: a single flat comparison"). This file defines that condition as
 * serializable data and the pure function that evaluates it against the
 * match-state bag, answering true/false: should the trigger fire?
 *
 * **No math in conditions — enforced by the type.** A condition operand is ONLY
 * a variable (read off the bag) or a constant — never an arithmetic expression.
 * This bakes the canon rule "math lives in the ACTION, never the CONDITION" into
 * the structure: a future builder literally cannot construct a math-in-condition.
 * A computed target (e.g., 70% of a win-target) is produced up front by a
 * THRESHOLD and posted to the bag; the condition just compares against it.
 *
 * **NEVER-BREAK CONTRACT.** Like the expression evaluator, this never throws. If
 * a condition can't be evaluated (a missing or non-numeric variable), it returns
 * `{ ok: false, reason }`; the caller logs it and treats the trigger as
 * NOT firing — scoring never breaks.
 *
 * @see ./types.ts — MatchStateBag
 * @see ./expression-evaluator.ts — the ACTION side (where math is allowed)
 * @see docs/league-system/modules/points-system/trigger.md — the CONDITION contract
 */

import type { MatchStateBag } from './types';

/**
 * A condition operand: a constant or a state-variable read. NOT an arithmetic
 * expression — conditions never compute (that's the ACTION's job).
 */
export type ConditionOperand =
  | { readonly kind: 'const'; readonly value: number }
  | { readonly kind: 'var'; readonly name: string };

/**
 * A trigger's firing condition.
 *
 * - `always` — always true (pass-through triggers, e.g. initial points).
 * - `compare` — one flat comparison between two operands.
 */
export type Condition =
  | { readonly kind: 'always' }
  | {
      readonly kind: 'compare';
      readonly left: ConditionOperand;
      readonly op: '==' | '>' | '<' | '>=' | '<=';
      readonly right: ConditionOperand;
    };

/**
 * Result of evaluating a condition. Never throws — an unevaluable condition is
 * reported as `{ ok: false, reason }` so the caller can log it and treat the
 * trigger as not firing, rather than crash live scoring.
 */
export type ConditionResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false; readonly reason: string };

/** Resolve an operand to a finite number, or throw (caught by the caller below). */
function resolveOperand(operand: ConditionOperand, state: Readonly<MatchStateBag>): number {
  if (operand.kind === 'const') return operand.value;
  const v = state[operand.name];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(
      `state variable "${operand.name}" is not a finite number (got ${JSON.stringify(v)})`,
    );
  }
  return v;
}

/**
 * Evaluate a trigger's condition against the match-state bag. **Never throws.**
 *
 * @param condition The condition (always / a flat comparison).
 * @param state     The match-state bag (read-only).
 * @returns `{ ok: true, value }` with the true/false result, or
 *   `{ ok: false, reason }` if an operand variable is missing/non-numeric. On
 *   failure the caller logs the reason and treats the trigger as NOT firing.
 */
export function evaluateCondition(
  condition: Condition,
  state: Readonly<MatchStateBag>,
): ConditionResult {
  if (condition.kind === 'always') {
    return { ok: true, value: true };
  }
  try {
    const left = resolveOperand(condition.left, state);
    const right = resolveOperand(condition.right, state);
    switch (condition.op) {
      case '==':
        return { ok: true, value: left === right };
      case '>':
        return { ok: true, value: left > right };
      case '<':
        return { ok: true, value: left < right };
      case '>=':
        return { ok: true, value: left >= right };
      case '<=':
        return { ok: true, value: left <= right };
    }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
