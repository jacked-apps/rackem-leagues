/**
 * @fileoverview Per-game allocator evaluator.
 *
 * Given a PerGameAllocator + the per-game record (who won, what counter
 * values were entered) + the cumulative state bag, produces the winner's
 * and loser's points contributions for this single game.
 *
 * **Locked SideConfig shape:** 2 fields per side.
 * - `base` is either a `number` (fixed value, no scorer input) OR a
 *   `SideInputRange` (range requiring scorer input each game).
 * - `formula` is optional. When non-null, the registered operation transforms
 *   the resolved base value using `ctx` (mechanism-internal) and the state
 *   bag (universal cumulative state).
 *
 * **Resolution order:**
 *   1. Resolve both sides' base values (fixed constants or clamped scorer input).
 *   2. Build a FormulaContext with both resolved bases and `thisSide`.
 *   3. For each side that has a formula, run it via the registry; otherwise
 *      use the base value.
 *
 * Formulas can read both sides' resolved base values via `ctx.winner` /
 * `ctx.loser`. They CANNOT see another formula side's final post-formula
 * output (avoiding mutual dependence); at most one side should be a formula
 * that reads the other side's value in practice.
 *
 * @see ./types.ts — PerGameAllocator, SideConfig, FormulaContext
 * @see ./allocator-formula-registry.ts — the operation registry formulas resolve through
 */

import { getAllocatorFormulaOperation } from './allocator-formula-registry';
import type {
  FormulaContext,
  MatchStateBag,
  PerGameAllocator,
  SideConfig,
  SideInputRange,
} from './types';

/**
 * Per-game record fed to the allocator. Captures everything the allocator
 * needs to compute this game's per-side contributions.
 */
export interface AllocatorGameRecord {
  winnerSide: 'home' | 'away';
  /** Counter input collected from the scorer for the winner side (or null if the winner's base isn't a range). */
  winnerCounterInput: number | null;
  /** Counter input collected from the scorer for the loser side (or null if the loser's base isn't a range). */
  loserCounterInput: number | null;
}

/**
 * Per-game evaluation result. winnerContribution + loserContribution are
 * the points to add to the winner's and loser's running totals respectively.
 */
export interface AllocatorEvaluation {
  winnerContribution: number;
  loserContribution: number;
}

/**
 * Type-guard: is the `base` value a `SideInputRange` (requires scorer input)
 * rather than a fixed number?
 */
function isInputRange(base: SideConfig['base']): base is SideInputRange {
  return typeof base === 'object' && base !== null && 'min' in base && 'max' in base;
}

/**
 * Resolve a side's base value to a number. For fixed bases, just the number.
 * For range bases, the clamped scorer input.
 */
function resolveBaseValue(config: SideConfig, counterInput: number | null): number {
  if (!isInputRange(config.base)) {
    return config.base;
  }
  if (counterInput == null || !Number.isFinite(counterInput)) {
    throw new Error(
      `Allocator side has range base ({min:${config.base.min}, max:${config.base.max}, label:"${config.base.label}"}) but no scorer input was provided; got ${JSON.stringify(counterInput)}`,
    );
  }
  return Math.max(config.base.min, Math.min(config.base.max, counterInput));
}

/**
 * If the side has a formula, run it through the registry; otherwise return
 * the already-resolved base value.
 */
function applyFormulaIfPresent(
  config: SideConfig,
  resolvedBase: number,
  ctx: FormulaContext,
  state: Readonly<MatchStateBag>,
): number {
  if (!config.formula) return resolvedBase;
  const operation = getAllocatorFormulaOperation(config.formula.operationKind);
  if (operation === undefined) {
    throw new Error(
      `Allocator formula references unknown operation "${config.formula.operationKind}"`,
    );
  }
  return operation.compute(config.formula.operationArgs, ctx, state);
}

/**
 * Evaluate a per-game allocator for a single game. Returns the winner's
 * and loser's points contributions.
 *
 * The state bag is passed read-only — allocator formulas read state but
 * never write. State mutation happens in the runtime caller after this
 * function returns (the runtime adds the contributions to home_points /
 * away_points).
 */
export function evaluateAllocator(
  allocator: PerGameAllocator,
  record: AllocatorGameRecord,
  state: Readonly<MatchStateBag>,
): AllocatorEvaluation {
  // Step 1: Resolve base values for both sides (without running formulas).
  const winnerBase = resolveBaseValue(allocator.winner, record.winnerCounterInput);
  const loserBase = resolveBaseValue(allocator.loser, record.loserCounterInput);

  // Step 2: Build formula contexts. ctx.thisSide carries which role
  // (winner/loser) the formula is computing for; ctx.winner/loser carry
  // the OTHER role's resolved value so formulas can cross-reference.
  const ctxForWinner: FormulaContext = {
    winner: winnerBase,
    loser: loserBase,
    thisSide: 'winner',
    winnerSide: record.winnerSide,
  };
  const ctxForLoser: FormulaContext = {
    winner: winnerBase,
    loser: loserBase,
    thisSide: 'loser',
    winnerSide: record.winnerSide,
  };

  // Step 3: Run formulas if present; otherwise use base values.
  const winnerContribution = applyFormulaIfPresent(
    allocator.winner,
    winnerBase,
    ctxForWinner,
    state,
  );
  const loserContribution = applyFormulaIfPresent(
    allocator.loser,
    loserBase,
    ctxForLoser,
    state,
  );

  return { winnerContribution, loserContribution };
}
