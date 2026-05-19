/**
 * @fileoverview Threshold resolver — looks up the operation for a given
 * `ThresholdRow` and runs it against the runtime inputs.
 *
 * Per the Ed-walked refactor: a Threshold row carries the row's identity
 * (name, scope), exposed compatibility metadata (expectedHandicapType,
 * expectedSize, outputType), and a reference to the operation
 * (operationKind + operationArgs). The resolver:
 *
 *   1. Looks up the operation in the registry by `operationKind`
 *   2. Defensively re-validates that the row's exposed metadata matches
 *      the operation's declared metadata (drift detection — if the row
 *      came from a stale DB or got corrupted, mismatch surfaces here
 *      instead of producing wrong values)
 *   3. Calls the operation's compute with `operationArgs` + the runtime
 *      `ThresholdInputs`
 *   4. Returns the produced number (or null)
 *
 * @see ./types.ts — ThresholdRow, ThresholdOperation
 * @see ./threshold-registry.ts — the operation lookup
 */

import { getThresholdOperation } from './threshold-registry';
import type {
  HandicapTypeRequirement,
  SizeRequirement,
  ThresholdInputs,
  ThresholdOperation,
  ThresholdOutputType,
  ThresholdRow,
} from './types';

/**
 * Resolve a threshold row's value at match start (or wherever the runtime
 * resolves thresholds). Throws if the operation is unregistered or the
 * row's exposed metadata drifts from the operation's declared metadata.
 */
export function resolveThreshold(
  row: ThresholdRow,
  inputs: ThresholdInputs,
): number | null {
  const operation = getThresholdOperation(row.operationKind);
  if (operation === undefined) {
    throw new Error(
      `Threshold "${row.name}" references unknown operation "${row.operationKind}"`,
    );
  }
  validateRowMatchesOperation(row, operation);
  return operation.compute(row.operationArgs, inputs);
}

/**
 * Construct a `ThresholdRow` from operation kind + args. Looks up the
 * operation in the registry, copies its consumes/produces metadata onto
 * the row's exposed fields, validates, and returns the row. This is the
 * canonical way to build a row in code; future DB-row loaders will
 * follow the same validation pattern.
 *
 * Use this helper rather than constructing rows by hand — it ensures the
 * exposed fields stay in sync with the registry's source of truth.
 */
export function buildThresholdRow(params: {
  name: string;
  operationKind: string;
  operationArgs?: Readonly<Record<string, unknown>>;
  scope?: ThresholdRow['scope'];
}): ThresholdRow {
  const operation = getThresholdOperation(params.operationKind);
  if (operation === undefined) {
    throw new Error(
      `buildThresholdRow: unknown operation "${params.operationKind}". Register the operation before building rows that reference it.`,
    );
  }
  return {
    name: params.name,
    scope: params.scope,
    expectedHandicapType: operation.consumesHandicapType,
    expectedSize: operation.consumesSize,
    outputType: operation.producesOutputType,
    operationKind: params.operationKind,
    operationArgs: params.operationArgs ?? {},
  };
}

/**
 * Defensive: re-check that the row's exposed fields match the registered
 * operation's declarations. Mismatch indicates drift — the row was likely
 * persisted under an older version of the operation that has since changed
 * its declared metadata.
 */
function validateRowMatchesOperation(
  row: ThresholdRow,
  operation: ThresholdOperation,
): void {
  if (row.expectedHandicapType !== operation.consumesHandicapType) {
    throw new Error(
      `Threshold "${row.name}" drift: row expectedHandicapType="${row.expectedHandicapType}" but operation "${operation.name}" consumes "${operation.consumesHandicapType}"`,
    );
  }
  if (!sizeMatches(row.expectedSize, operation.consumesSize)) {
    throw new Error(
      `Threshold "${row.name}" drift: row expectedSize doesn't match operation "${operation.name}" consumesSize`,
    );
  }
  if (row.outputType !== operation.producesOutputType) {
    throw new Error(
      `Threshold "${row.name}" drift: row outputType="${row.outputType}" but operation "${operation.name}" produces "${operation.producesOutputType}"`,
    );
  }
}

function sizeMatches(a: SizeRequirement, b: SizeRequirement): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'lineup_sizes' && b.kind === 'lineup_sizes') {
    if (a.sizes === 'any' && b.sizes === 'any') return true;
    if (a.sizes === 'any' || b.sizes === 'any') return false;
    if (a.sizes.length !== b.sizes.length) return false;
    return a.sizes.every((size, i) => size === b.sizes[i]);
  }
  // 'single' and 'none' have no further structure
  return true;
}

/**
 * Re-export the input/output types so callers don't need to import from
 * multiple files.
 */
export type {
  HandicapTypeRequirement,
  SizeRequirement,
  ThresholdInputs,
  ThresholdOperation,
  ThresholdOutputType,
  ThresholdRow,
};
