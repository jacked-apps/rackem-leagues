/**
 * @fileoverview Action evaluator — resolves an Action's `target`/`value` against
 * runtime state and mutates the match-state bag.
 *
 * Every Action has the same uniform shape `{ target, op, value }`:
 *  - `target` is a concrete variable name in the match-state bag
 *  - `value` resolves to a concrete MatchStateValue (literal / input-ref /
 *    variable-ref)
 *  - `op` combines value with target's current value (`assign | add | multiply`)
 *
 * The runtime calls this on each trigger fire. No action categories; same
 * code path for "give 1.5 to home_points" and "set endmatch to true."
 *
 * @see ./types.ts — the Action / ActionValue / ActionTarget types
 */

import type { Action, ActionValue, MatchStateBag, MatchStateValue } from './types';

/**
 * Runtime context the action evaluator needs alongside the match-state bag.
 *
 * - `inputValue` — the trigger's bound input value (`n`), resolved from
 *   `Trigger.input.thresholdRef` once per firing. Undefined if the trigger
 *   declared no input (rare; only receipt/match_end with no threshold read).
 *   Null if the bound threshold's operation returned null at this match's
 *   inputs (only legal for actions that don't reference input_ref).
 */
export interface ActionContext {
  inputValue: number | null | undefined;
}

/**
 * Resolve an ActionValue to a concrete MatchStateValue.
 *
 * Throws on unresolvable references — a reference to input on a trigger with
 * no input, or a variable that doesn't exist, is a composition error that
 * should fail loudly at evaluation time, not silently produce wrong values.
 */
export function resolveValue(
  value: ActionValue,
  state: MatchStateBag,
  ctx: ActionContext,
): MatchStateValue {
  switch (value.kind) {
    case 'literal':
      return value.value;
    case 'input_ref': {
      if (ctx.inputValue === undefined) {
        throw new Error(
          'Action uses input_ref but the trigger declared no input',
        );
      }
      return ctx.inputValue;
    }
    case 'variable_ref': {
      const v = state[value.variableName];
      if (v === undefined) {
        throw new Error(
          `Action references undefined variable "${value.variableName}"`,
        );
      }
      return v;
    }
  }
}

/**
 * Apply an op to combine the current variable value with the new value.
 *
 * Op semantics:
 *  - `assign` — replace current with new
 *  - `add` — numeric addition; throws if either side isn't a number
 *  - `multiply` — numeric multiplication; throws if either side isn't a number
 */
export function applyOp(
  op: Action['op'],
  current: MatchStateValue | undefined,
  next: MatchStateValue,
): MatchStateValue {
  if (op === 'assign') {
    return next;
  }
  if (typeof current !== 'number' || typeof next !== 'number') {
    throw new Error(
      `Op "${op}" requires numeric operands; got current=${JSON.stringify(current)}, next=${JSON.stringify(next)}`,
    );
  }
  if (op === 'add') return current + next;
  return current * next;
}

/**
 * Evaluate an action: resolve its target and value against state + context,
 * apply the op, and mutate the match-state bag.
 *
 * Returns the mutated state bag for chaining (the bag is mutated in place;
 * caller passes a copy if immutability is needed).
 */
export function evaluateAction(
  action: Action,
  state: MatchStateBag,
  ctx: ActionContext,
): MatchStateBag {
  const targetName = action.target.variableName;
  const resolvedValue = resolveValue(action.value, state, ctx);
  const current = state[targetName];
  const next = applyOp(action.op, current, resolvedValue);
  state[targetName] = next;
  return state;
}
