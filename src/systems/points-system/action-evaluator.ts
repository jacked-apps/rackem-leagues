/**
 * @fileoverview Action evaluator — resolves an Action's `target`/`value` against
 * runtime state and mutates the match-state bag.
 *
 * Every Action has the same uniform shape `{ target, op, value }`:
 *  - `target` resolves to a concrete variable name (concrete or side-scoped)
 *  - `value` resolves to a concrete MatchStateValue (literal / threshold-ref /
 *    variable-ref / triggering-side)
 *  - `op` combines value with target's current value (`assign | add | multiply`)
 *
 * The runtime calls this on each trigger fire. No action categories; same
 * code path for "give 10 points to home" and "set endgame_chip to true."
 *
 * @see ./types.ts — the Action / ActionValue / ActionTarget types
 */

import type { Action, ActionValue, MatchStateBag, MatchStateValue } from './types';

/**
 * Runtime context the action evaluator needs alongside the match-state bag.
 *
 * - `thresholdValues` — resolved threshold values keyed by threshold name
 *   (populated at match start when receipt triggers fire)
 * - `triggeringSide` — for triggers that fire because a specific side
 *   crossed a value (e.g., milestone reached), this identifies which side
 *   so side-scoped targets and the `triggering_side` ActionValue can resolve
 */
export interface ActionContext {
  thresholdValues: Readonly<Record<string, number>>;
  triggeringSide: 'home' | 'away' | null;
}

/**
 * Resolve an ActionValue to a concrete MatchStateValue.
 *
 * Throws on unresolvable references — a reference to a threshold or variable
 * that doesn't exist is a composition error that should fail loudly at
 * evaluation time, not silently produce wrong values.
 */
export function resolveValue(
  value: ActionValue,
  state: MatchStateBag,
  ctx: ActionContext,
): MatchStateValue {
  switch (value.kind) {
    case 'literal':
      return value.value;
    case 'threshold_ref': {
      const v = ctx.thresholdValues[value.thresholdRef];
      if (v === undefined) {
        throw new Error(
          `Action references undefined threshold "${value.thresholdRef}"`,
        );
      }
      return v;
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
    case 'triggering_side':
      if (ctx.triggeringSide === null) {
        throw new Error(
          'Action uses triggering_side but the trigger has no associated side',
        );
      }
      return ctx.triggeringSide;
  }
}

/**
 * Resolve an ActionTarget to a concrete variable name.
 *
 * For `side_scoped` targets, the template `<side>` is substituted with the
 * triggering side. Throws if there's no triggering side context but the
 * target is side-scoped (composition error).
 */
export function resolveTarget(
  target: Action['target'],
  ctx: ActionContext,
): string {
  if (target.kind === 'concrete') {
    return target.variableName;
  }
  if (ctx.triggeringSide === null) {
    throw new Error(
      `Action uses side-scoped target template "${target.variableNameTemplate}" but the trigger has no associated side`,
    );
  }
  return target.variableNameTemplate.replace('<side>', ctx.triggeringSide);
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
  const targetName = resolveTarget(action.target, ctx);
  const resolvedValue = resolveValue(action.value, state, ctx);
  const current = state[targetName];
  const next = applyOp(action.op, current, resolvedValue);
  state[targetName] = next;
  return state;
}
