/**
 * @fileoverview Allocator-formula operation registry.
 *
 * Parallel to the Threshold operation registry, but for the per-game allocator's
 * formula slot on a `SideConfig`. Same data-driven pattern: a SideConfig's
 * `formula` references an operation by name + args; the registry resolves to
 * an `AllocatorFormulaOperation` with the compute function.
 *
 * **Separate registry from threshold operations** because the signatures
 * differ:
 * - Threshold operations consume `ThresholdInputs` and produce a single
 *   number/null (no per-game context).
 * - Allocator-formula operations consume mechanism-internal `ctx`
 *   (winner/loser/thisSide for THIS game) PLUS the cumulative state bag
 *   (read-only — formulas don't write).
 *
 * Mixing the two would require a polymorphic signature; keeping them
 * separate keeps each operation's contract tight and self-documenting.
 *
 * @see ./types.ts — AllocatorFormulaOperation, SideConfig, FormulaContext
 * @see ./allocator-evaluator.ts — uses this registry at evaluation time
 */

import type { AllocatorFormulaOperation } from './types';

const registry = new Map<string, AllocatorFormulaOperation>();

/**
 * Register an `AllocatorFormulaOperation` under its `name`. Operations
 * register themselves at module load time.
 *
 * Throws if a collision occurs — two modules registering the same operation
 * name is a bug. Tests can call {@link clearAllocatorFormulaRegistry} between
 * cases.
 */
export function registerAllocatorFormulaOperation(
  operation: AllocatorFormulaOperation,
): void {
  if (registry.has(operation.name)) {
    throw new Error(
      `AllocatorFormulaOperation "${operation.name}" already registered`,
    );
  }
  registry.set(operation.name, operation);
}

/**
 * Look up an `AllocatorFormulaOperation` by name. Returns `undefined` if not
 * found — callers should throw with a meaningful error rather than silently
 * fall through.
 */
export function getAllocatorFormulaOperation(
  name: string,
): AllocatorFormulaOperation | undefined {
  return registry.get(name);
}

/**
 * Test helper: clear the registry.
 */
export function clearAllocatorFormulaRegistry(): void {
  registry.clear();
}

/**
 * Test helper: snapshot registered operation names.
 */
export function registeredAllocatorFormulaOperationNames(): readonly string[] {
  return [...registry.keys()];
}
