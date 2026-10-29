/**
 * @fileoverview `linear_above_threshold` points calculator —
 * one linear line through PAR (Phase 1 Unit 1.2 of the modular-league-system v2 plan).
 *
 * Lifts the existing `src/types/match.ts:calculatePoints` formula into a
 * standalone PointsCalculator so it can be dispatched by name from the
 * runtime. Behavior is identical to the legacy function — characterization
 * tests guard the equivalence.
 *
 * THE RULE — Ed's league scoresheet formula, byte-for-byte (TABLE n!O19/P19:
 * `points = games_won − IF(to_tie = "X", to_win, to_tie)`). Given thresholds
 * W = games_to_win and T = games_to_tie, a side's PAR is T when a tie is
 * possible, else W, and:
 *
 *   points = (games_won − par) × multiplier
 *
 * Example, tie possible with T = 9 / W = 10: win 10–8 → +1 / −1;
 * 12–6 → +3 / −3; 9–9 → 0 / 0. An earlier version scored winners from W
 * instead (10–8 → 0), leaking −1 into the league total on every decided
 * tie-possible match (fixed 2026-10-27).
 *
 * **The user-specified rule:** "If I need 10 to win or 9 to tie, and the
 * regular games end 9-9, the match goes to a tiebreaker. If I win the
 * tiebreaker, I do NOT get -1 points (because I 'fell short' of my 10-game
 * target) — I get **0 points**. If I lose the tiebreaker, I do NOT get -1
 * points either — I still get **0 points**. The tiebreaker decides
 * match-win/loss; per-match points come from the regular-game count only,
 * and par absorbs both outcomes at 0."
 *
 * Par absorbing a tied match is implemented HERE (in the formula). The
 * caller is responsible for passing in the regular-only games_won (excluding
 * tiebreakers); this calculator's contract is "given a games_won number,
 * apply the par formula." It does not filter — that's the caller's
 * job in the per-game scoring mutation (Phase 5 Unit 5.5).
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 1.2)
 * @see docs/plans/2026-04-28-001-feat-modular-league-system-plan-supplements/architectural-reframe-2026-05-01.md
 *      Section 2 (worked-example table) and Section 4 (anti-pattern: tiebreaker outcome leaking)
 */

import { z } from 'zod';
import type { AggregatePointsCalculator } from './types';

// ============================================================================
// Params
// ============================================================================

/**
 * Parameters for the `linear_above_threshold` calculator. The multiplier
 * scales the linear bands (above-win and below-tie) but never moves the
 * tie band off zero — that's a locked invariant.
 */
export interface LinearAboveThresholdParams {
  /**
   * Multiplier applied to the linear bands. Default 1 (one point per game
   * over / under threshold). An LO who wants double weight sets 2 (two
   * points per extra game). Half-weight is also valid (0.5).
   *
   * The multiplier is applied to the linear bands ONLY. The tie band
   * stays at 0 regardless of multiplier value (locked invariant).
   */
  per_extra_game_multiplier: number;
}

/**
 * zod schema for params. Used at save-time by the wizard's form validation
 * AND at runtime by `compute` (defense-in-depth — malformed params produce
 * a logged warning + safe-default fallback rather than NaN propagating
 * into match scoring).
 *
 * Multiplier must be a finite real number. We deliberately don't enforce
 * a min/max here — an LO could legitimately want negative or zero values
 * (combo-coherence validator catches the truly nonsensical combinations).
 */
export const linearAboveThresholdParamSchema = z.object({
  per_extra_game_multiplier: z.number().finite(),
});

/** Tested Preset values (BCA 3v3 default — multiplier 1 = "one point per extra game"). */
export const LINEAR_ABOVE_THRESHOLD_DEFAULT_PARAMS: LinearAboveThresholdParams = {
  per_extra_game_multiplier: 1,
};

// ============================================================================
// The math
// ============================================================================

/**
 * Apply the par formula. Pure function — no side effects.
 *
 * Returns 0 when:
 *   - thresholds.games_to_win is null (caller passed bad input — defensive)
 *   - games_won === par (a tie at the tie target, or exactly the win target
 *     when ties are not possible)
 */
/**
 * Normalize -0 to +0. JavaScript distinguishes them (Object.is(-0, 0) === false),
 * which leaks into test framework strict-equality checks AND would display as
 * "-0" in the UI. Always return +0 from the formula; consumers don't care
 * about the sign of zero.
 */
function normZero(n: number): number {
  return n === 0 ? 0 : n;
}

function computePoints(
  gamesWon: number,
  gamesToWin: number,
  gamesToTie: number | null,
  multiplier: number,
): number {
  // Par = the tie target when a tie is possible, else the win target.
  const par = gamesToTie ?? gamesToWin;
  return normZero((gamesWon - par) * multiplier);
}

// ============================================================================
// Calculator
// ============================================================================

/**
 * The `linear_above_threshold` calculator. Aggregate-input. Takes
 * (games_won, thresholds, params) and returns points.
 *
 * Tested Preset value: BCA 3v3 default (multiplier 1). LO can edit the
 * multiplier in League Settings.
 */
export const linearAboveThreshold: AggregatePointsCalculator<LinearAboveThresholdParams> = {
  name: 'linear_above_threshold',
  kind: 'aggregate',
  defaultParams: LINEAR_ABOVE_THRESHOLD_DEFAULT_PARAMS,
  paramSchema: linearAboveThresholdParamSchema,

  // Aggregate calculators don't drive per-game UI fields. The per-game popup
  // only needs the (always-implicit) winner picker; achievements are
  // preference-driven and live outside the calculator's spec.
  scoringPopupFields: () => ({ perSideInputs: null }),

  compute: ({ gamesWon, thresholds }, params) => {
    // Empty/missing params → use defaults silently. The wizard writes
    // `{}` for leagues that didn't customize calculator params, so this
    // is the COMMON case, not a malformed-input case.
    const isEmpty =
      params == null ||
      (typeof params === 'object' && Object.keys(params as object).length === 0);

    let multiplier: number;
    if (isEmpty) {
      multiplier = LINEAR_ABOVE_THRESHOLD_DEFAULT_PARAMS.per_extra_game_multiplier;
    } else {
      // Non-empty params: validate. zod rejects malformed input; we substitute
      // the default multiplier and log a warning so a bad params blob produces
      // visible breadcrumbs rather than NaN propagating into points.
      const parsed = linearAboveThresholdParamSchema.safeParse(params);
      if (parsed.success) {
        multiplier = parsed.data.per_extra_game_multiplier;
      } else {
        console.warn(
          '[linear_above_threshold] params failed zod validation — falling back to default multiplier=1',
          { params, error: parsed.error.message },
        );
        multiplier = LINEAR_ABOVE_THRESHOLD_DEFAULT_PARAMS.per_extra_game_multiplier;
      }
    }

    // Defensive on thresholds. Caller should pass valid thresholds; if
    // games_to_win is null/undefined we have nothing to compare against
    // and return 0 (graceful — no NaN, no throw, no bad arithmetic).
    if (thresholds.games_to_win == null) {
      console.warn(
        '[linear_above_threshold] thresholds.games_to_win is null — returning 0 points',
      );
      return 0;
    }

    return computePoints(
      gamesWon,
      thresholds.games_to_win,
      thresholds.games_to_tie,
      multiplier,
    );
  },
};
