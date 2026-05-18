/**
 * @fileoverview EndOfMatchAggregate implementations for Phase A.
 *
 * Ships the one (D) variant needed by Points 3-Man: a linear-above-threshold
 * aggregate with the locked 3v3 9-9 tie-band absorption rule.
 *
 * **Locked tie-band rule (per `docs/league-system/modules/points-system/README.md`):**
 * when a side's games_won equals the tie threshold, that side's per-match
 * points = 0 — regardless of multiplier value, regardless of tiebreaker
 * outcome. This invariant lives INSIDE the formula here; it is not
 * configurable and not exposed as a parameter. Stripping it would break
 * the documented contract for Points 3-Man.
 *
 * **Three-band formula:**
 * - Above-win:    games_won > W            → (games_won − W) × multiplier
 * - Tie band:     T ≤ games_won ≤ W        → 0 (locked)
 * - Below-tie:    games_won < T            → (games_won − T) × multiplier
 *
 * When ties are not possible (tie threshold = null), the tie band collapses
 * to a single value at games_won = W (still 0), and the formula reduces to
 * `(games_won − W) × multiplier` everywhere else.
 *
 * @see ./types.ts — EndOfMatchAggregate, AggregateInput, AggregateResult
 * @see src/systems/calculators/linear_above_threshold.ts — the legacy
 *   bundled implementation this primitive replaces (cross-audited)
 */

import type {
  AggregateInput,
  AggregateResult,
  EndOfMatchAggregate,
} from './types';

/**
 * Params for the linear-above-threshold aggregate. `multiplier` scales the
 * linear bands; the tie band stays at 0 regardless of multiplier value.
 */
export interface LinearAboveThresholdParams {
  multiplier: number;
}

const DEFAULT_LINEAR_PARAMS: LinearAboveThresholdParams = {
  multiplier: 1,
};

function computeSidePoints(
  gamesWon: number,
  winTarget: number,
  tieTarget: number | null,
  multiplier: number,
): number {
  if (tieTarget === null) {
    // No tie possible — single-line formula above-or-below win threshold.
    return (gamesWon - winTarget) * multiplier;
  }
  if (gamesWon > winTarget) {
    return (gamesWon - winTarget) * multiplier;
  }
  if (gamesWon < tieTarget) {
    return (gamesWon - tieTarget) * multiplier;
  }
  // Tie band — locked invariant: 0 regardless of multiplier.
  return 0;
}

/**
 * Build a `linear_above_threshold`-style EndOfMatchAggregate with the given
 * multiplier. Reads homeWins/awayWins + the win/tie targets per side from
 * the aggregate input bag; applies the three-band formula with tie-band
 * absorption.
 *
 * Phase A: a factory because the composition layer will instantiate one per
 * Scoring System with the league's configured params.
 */
export function linearAboveThresholdAggregate(
  params: Partial<LinearAboveThresholdParams> = {},
): EndOfMatchAggregate {
  const resolvedParams: LinearAboveThresholdParams = {
    ...DEFAULT_LINEAR_PARAMS,
    ...params,
  };

  return {
    name: 'linear_above_threshold',
    params: resolvedParams as unknown as Record<string, unknown>,
    compute: (input: AggregateInput, paramsArg): AggregateResult => {
      const p = paramsArg as unknown as LinearAboveThresholdParams;
      const multiplier =
        typeof p.multiplier === 'number' && Number.isFinite(p.multiplier)
          ? p.multiplier
          : DEFAULT_LINEAR_PARAMS.multiplier;
      return {
        homePoints: computeSidePoints(
          input.homeWins,
          input.homeWinTarget,
          input.homeTieTarget,
          multiplier,
        ),
        awayPoints: computeSidePoints(
          input.awayWins,
          input.awayWinTarget,
          input.awayTieTarget,
          multiplier,
        ),
      };
    },
  };
}
