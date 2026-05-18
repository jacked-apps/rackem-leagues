/**
 * @fileoverview Per-game allocator evaluator.
 *
 * Given a PerGameAllocator + the per-game record (who won, what counter
 * values were entered) + cumulative match-state (for formulas that
 * reference cumulative state), produces the winner's points contribution
 * and the loser's points contribution for this single game.
 *
 * Side resolution rules per the locked Points System spec + the Ed-walked
 * decomposition:
 *
 * - `fixed` side → resolved value = the configured `points` constant; no
 *   scorer input expected
 * - `counter` side → resolved value = the per-game counter input (clamped
 *   to the configured min/max range)
 * - `formula` side → resolved value = formula(ctx); ctx.winner and ctx.loser
 *   are the OPPOSITE sides' resolved values (formula sides can't reference
 *   each other to avoid circular evaluation)
 *
 * The runtime calls this once per game per team perspective. The output
 * lands in the team's running-points variable via the standard action
 * machinery (the per-game increment is conceptually a built-in trigger
 * that fires on every game).
 *
 * @see ./types.ts — PerGameAllocator, SideConfig, FormulaContext
 */

import type {
  FormulaContext,
  PerGameAllocator,
  SideConfig,
} from './types';

/**
 * Per-game record fed to the allocator. Captures everything the allocator
 * needs to compute this game's per-side contributions.
 */
export interface AllocatorGameRecord {
  winnerSide: 'home' | 'away';
  /** Counter input collected from the scorer for the winner side (or null if the side isn't a counter). */
  winnerCounterInput: number | null;
  /** Counter input collected from the scorer for the loser side (or null if not a counter). */
  loserCounterInput: number | null;
}

/**
 * Cumulative match-state needed by formulas. Reflects state BEFORE this game.
 */
export interface AllocatorCumulativeState {
  home: { wins: number; points: number };
  away: { wins: number; points: number };
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
 * Resolve the non-formula sides first to populate ctx for any formula sides.
 *
 * For a fixed side, resolved = the configured constant.
 * For a counter side, resolved = the clamped counter input.
 * For a formula side, resolved = the base value (the formula's `ctx.<thisSide>`
 *   value, before the formula itself runs).
 *
 * Formulas can therefore reference the OPPOSITE side's resolved value
 * (ctx.winner or ctx.loser) — but a formula side cannot evaluate to a value
 * that another formula side depends on. (Both sides being formulas would
 * require a different evaluation strategy; not supported in Phase A.)
 */
function resolveBaseValue(config: SideConfig, counterInput: number | null): number {
  if (config.kind === 'fixed') return config.points;
  if (config.kind === 'counter') {
    if (counterInput == null || !Number.isFinite(counterInput)) {
      throw new Error(
        `Counter side requires a numeric input; got ${JSON.stringify(counterInput)}`,
      );
    }
    return Math.max(config.min, Math.min(config.max, counterInput));
  }
  // formula
  return config.base;
}

/**
 * If the side config is a formula, evaluate it with the provided context.
 * Otherwise return the already-resolved base value.
 */
function applyFormulaIfPresent(
  config: SideConfig,
  resolvedBase: number,
  ctx: FormulaContext,
): number {
  if (config.kind === 'formula') {
    return config.formula(ctx);
  }
  return resolvedBase;
}

/**
 * Evaluate a per-game allocator for a single game. Returns the winner's
 * and loser's points contributions.
 */
export function evaluateAllocator(
  allocator: PerGameAllocator,
  record: AllocatorGameRecord,
  cumulativeState: AllocatorCumulativeState,
): AllocatorEvaluation {
  // Step 1: Resolve base values for both sides (without running formulas).
  const winnerBase = resolveBaseValue(allocator.winner, record.winnerCounterInput);
  const loserBase = resolveBaseValue(allocator.loser, record.loserCounterInput);

  // Step 2: Build formula context. The 'thisSide' field is filled per
  // perspective when evaluating each side's formula.
  const winnerSide = record.winnerSide;
  const loserSide: 'home' | 'away' = winnerSide === 'home' ? 'away' : 'home';

  const ctxForWinner: FormulaContext = {
    winner: winnerBase,
    loser: loserBase,
    thisSide: winnerSide,
    home: { ...cumulativeState.home },
    away: { ...cumulativeState.away },
  };
  const ctxForLoser: FormulaContext = {
    winner: winnerBase,
    loser: loserBase,
    thisSide: loserSide,
    home: { ...cumulativeState.home },
    away: { ...cumulativeState.away },
  };

  // Step 3: Run formulas if present; otherwise use base values.
  const winnerContribution = applyFormulaIfPresent(
    allocator.winner,
    winnerBase,
    ctxForWinner,
  );
  const loserContribution = applyFormulaIfPresent(
    allocator.loser,
    loserBase,
    ctxForLoser,
  );

  return { winnerContribution, loserContribution };
}
