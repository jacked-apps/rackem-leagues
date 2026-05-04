/**
 * @fileoverview `linear_above_threshold` points calculator —
 * three-band linear formula (Phase 1 Unit 1.2 of the modular-league-system v2 plan).
 *
 * Lifts the existing `src/types/match.ts:calculatePoints` formula into a
 * standalone PointsCalculator so it can be dispatched by name from the
 * runtime. Behavior is identical to the legacy function — characterization
 * tests guard the equivalence.
 *
 * THE TIE-BAND RULE — locked invariant from the supplement (Section 4
 * anti-pattern). Three bands, given thresholds W = games_to_win,
 * T = games_to_tie:
 *
 *   - Above-win:    games_won > W            → (games_won - W) * multiplier
 *   - Tie band:     T <= games_won <= W      → 0  (always 0, regardless of multiplier)
 *   - Below-tie:    games_won < T            → (games_won - T) * multiplier
 *
 * When ties are NOT possible (games_to_tie === null), the tie band collapses
 * to a single value at games_won === W (still 0) and the formula reduces to
 * `(games_won - W) * multiplier`.
 *
 * **The user-specified rule:** "If I need 10 to win or 9 to tie, and the
 * regular games end 9-9, the match goes to a tiebreaker. If I win the
 * tiebreaker, I do NOT get -1 points (because I 'fell short' of my 10-game
 * target) — I get **0 points**. If I lose the tiebreaker, I do NOT get -1
 * points either — I still get **0 points**. The tiebreaker decides
 * match-win/loss; per-match points come from the regular-game count only,
 * and the tie band absorbs both outcomes at 0."
 *
 * The tie-band absorption rule is implemented HERE (in the formula). The
 * caller is responsible for passing in the regular-only games_won (excluding
 * tiebreakers); this calculator's contract is "given a games_won number,
 * apply the three-band formula." It does not filter — that's the caller's
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
 * Apply the three-band formula. Pure function — no side effects.
 *
 * Returns 0 when:
 *   - thresholds.games_to_win is null (caller passed bad input — defensive)
 *   - games_won lands in the tie band (the locked invariant)
 *   - games_won === games_to_win when ties are not possible (the tie band
 *     collapses to a single value at W)
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
  if (gamesToTie !== null) {
    // Three bands.
    if (gamesWon > gamesToWin) {
      return normZero((gamesWon - gamesToWin) * multiplier);
    }
    if (gamesWon >= gamesToTie && gamesWon <= gamesToWin) {
      // Tie band — always 0, multiplier never moves this off zero.
      return 0;
    }
    // Below-tie band — negative when multiplier is positive.
    return normZero((gamesWon - gamesToTie) * multiplier);
  }
  // No tie possible — formula collapses to (games_won - W) * multiplier.
  return normZero((gamesWon - gamesToWin) * multiplier);
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
