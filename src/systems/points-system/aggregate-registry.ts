/**
 * @fileoverview End-of-match aggregate operation registry.
 *
 * Parallel to the threshold + allocator-formula registries. An
 * `EndOfMatchAggregate` row references an aggregate operation by name + args;
 * the registry resolves to an `AggregateOperation` whose compute reads the
 * match-state bag and produces both sides' per-match points.
 *
 * Separate registry from the others because the signature differs: aggregate
 * operations consume (args, state) and produce an `AggregateResult`
 * (both sides at once), not a single number.
 *
 * @see ./types.ts — AggregateOperation, EndOfMatchAggregate, AggregateResult
 * @see ./runtime.ts — uses this registry at match end
 */

import type { AggregateOperation } from './types';

const registry = new Map<string, AggregateOperation>();

/**
 * Register an `AggregateOperation` under its `name`. Operations register
 * themselves at module load time. Throws on collision.
 */
export function registerAggregateOperation(operation: AggregateOperation): void {
  if (registry.has(operation.name)) {
    throw new Error(`AggregateOperation "${operation.name}" already registered`);
  }
  registry.set(operation.name, operation);
}

/**
 * Look up an `AggregateOperation` by name. Returns `undefined` if not found.
 */
export function getAggregateOperation(name: string): AggregateOperation | undefined {
  return registry.get(name);
}

/**
 * Test helper: clear the registry.
 */
export function clearAggregateRegistry(): void {
  registry.clear();
}

/**
 * Test helper: snapshot registered operation names.
 */
export function registeredAggregateOperationNames(): readonly string[] {
  return [...registry.keys()];
}
