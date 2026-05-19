/**
 * @fileoverview Threshold operation registry.
 *
 * Named-operation registry for the data-driven Threshold model per the
 * Ed-walked refactor (2026-05-19). A `ThresholdRow` references an
 * operation by its registered name; the registry resolves the name to a
 * `ThresholdOperation` with its compute function + declared consumes/produces
 * shape metadata.
 *
 * Why a code-side registry instead of inlining functions on each threshold
 * row: the threshold ROW is data (eventually a DB row). The operation
 * COMPUTE LOGIC lives in code. Separating them means the same operation can
 * be referenced by N threshold rows; updates to the operation logic ship
 * via code release while threshold rows stay LO-editable.
 *
 * @see ./types.ts — ThresholdOperation, ThresholdRow types
 * @see ./threshold-resolver.ts — uses this registry at evaluation time
 */

import type { ThresholdOperation } from './types';

const registry = new Map<string, ThresholdOperation>();

/**
 * Register a `ThresholdOperation` under its `name`. Operations register
 * themselves at module load time (the operation-implementation files call
 * this from their top level).
 *
 * Throws if an operation with the same name is already registered — collision
 * indicates a bug (two modules registering the same operation name).
 * Tests can call {@link clearThresholdRegistry} between cases.
 */
export function registerThresholdOperation(operation: ThresholdOperation): void {
  if (registry.has(operation.name)) {
    throw new Error(
      `ThresholdOperation "${operation.name}" already registered`,
    );
  }
  registry.set(operation.name, operation);
}

/**
 * Look up a `ThresholdOperation` by its registered name. Returns `undefined`
 * if not found — callers should throw with a meaningful error rather than
 * silently fall through.
 */
export function getThresholdOperation(
  name: string,
): ThresholdOperation | undefined {
  return registry.get(name);
}

/**
 * Test helper: clear the registry. Call from `beforeEach` to ensure tests
 * don't leak operation registrations across cases.
 */
export function clearThresholdRegistry(): void {
  registry.clear();
}

/**
 * Test helper: snapshot the registered operation names. Useful for asserting
 * which operations are registered at any given point.
 */
export function registeredThresholdOperationNames(): readonly string[] {
  return [...registry.keys()];
}
