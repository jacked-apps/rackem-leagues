/**
 * @fileoverview Composition-build validation for PointsSystem compositions.
 *
 * Enforces the trigger-model invariants at composition construction time so
 * drift can't sneak through:
 *
 *   1. **Trigger names are unique within a composition.** Prevents typos and
 *      makes the runtime's re-arm bookkeeping (keyed by name) unambiguous.
 *
 *   2. **Allocator formula references resolve.** If a per-game allocator side
 *      declares a formula, its `operationKind` must name a registered
 *      allocator-formula operation. Catches typos / unregistered operations
 *      at composition-build time instead of mid-match.
 *
 * **State-var bookkeeping (light).** For each trigger we collect the state-var
 * names it READS (condition operands of kind `'var'`; expression nodes of kind
 * `'var'`) and the var it WRITES (`action.target`). This isn't enforced yet —
 * the open state-bag namespace means a trigger may legitimately read a var
 * another trigger or a threshold wrote — but collecting it keeps the structure
 * available for a future "every read has a writer" check and documents intent.
 *
 * Compositions call `validatePointsSystem(composition)` as the last step of
 * their factory function. Throws with a precise message on any violation.
 *
 * @see ./types.ts — the PointsSystem / Trigger / ThresholdRow shapes
 */

import { getAllocatorFormulaOperation } from './allocator-formula-registry';
import type {
  Condition,
  Expression,
  PointsSystem,
  SideConfig,
  Trigger,
} from './types';

/**
 * Collect the state-var names a condition reads (operands of kind `'var'`).
 */
function conditionReads(condition: Condition): string[] {
  if (condition.kind === 'always') return [];
  const reads: string[] = [];
  if (condition.left.kind === 'var') reads.push(condition.left.name);
  if (condition.right.kind === 'var') reads.push(condition.right.name);
  return reads;
}

/**
 * Collect the state-var names an expression reads (nodes of kind `'var'`).
 */
function expressionReads(expr: Expression): string[] {
  switch (expr.kind) {
    case 'const':
      return [];
    case 'var':
      return [expr.name];
    case 'op':
      return [...expressionReads(expr.left), ...expressionReads(expr.right)];
  }
}

/**
 * The state vars a single trigger reads + the one it writes. Returned for the
 * benefit of future cross-trigger checks; not enforced today.
 */
export interface TriggerVarUsage {
  readonly name: string;
  readonly reads: readonly string[];
  readonly writes: string;
}

/**
 * Compute a trigger's read/write var usage. Reads come from the condition plus
 * (for `expr` actions) the action expression; the write is `action.target`.
 */
function triggerVarUsage(trigger: Trigger): TriggerVarUsage {
  const reads = [...conditionReads(trigger.condition)];
  if (trigger.action.value.kind === 'expr') {
    reads.push(...expressionReads(trigger.action.value.expr));
  }
  return { name: trigger.name, reads, writes: trigger.action.target };
}

/**
 * Validate that a per-game allocator side's formula (if present) references a
 * registered allocator-formula operation. Throws on unresolved reference.
 */
function validateAllocatorSide(
  composition: PointsSystem,
  side: SideConfig,
  sideName: 'winner' | 'loser',
): void {
  if (!side.formula) return;
  const operation = getAllocatorFormulaOperation(side.formula.operationKind);
  if (operation === undefined) {
    throw new Error(
      `Composition "${composition.name}": allocator ${sideName} side references unknown formula operation "${side.formula.operationKind}". Ensure the operation file is imported (operations auto-register on import).`,
    );
  }
}

/**
 * Validate a PointsSystem composition against the trigger-model invariants.
 * Throws on the first violation found.
 */
export function validatePointsSystem(composition: PointsSystem): void {
  const seenTriggerNames = new Set<string>();

  if (composition.perGameAllocator) {
    validateAllocatorSide(composition, composition.perGameAllocator.winner, 'winner');
    validateAllocatorSide(composition, composition.perGameAllocator.loser, 'loser');
  }

  for (const trigger of composition.triggers) {
    if (seenTriggerNames.has(trigger.name)) {
      throw new Error(
        `Composition "${composition.name}": duplicate trigger name "${trigger.name}"`,
      );
    }
    seenTriggerNames.add(trigger.name);

    // Collect read/write var usage. Not enforced yet (open namespace), but
    // computing it keeps the shape available for future checks + surfaces
    // malformed action/condition trees as a type error at build.
    triggerVarUsage(trigger);
  }
}
