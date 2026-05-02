/**
 * @fileoverview `accumulate_with_milestone_jumps` points calculator —
 * monotonic accumulation with two stepped jumps (Phase 1 Unit 1.3 of the
 * modular-league-system v2 plan).
 *
 * Lifts the existing `src/types/match.ts:calculateBCAPoints` formula into
 * a standalone PointsCalculator. Behavior is identical — characterization
 * tests guard the equivalence.
 *
 * Formula shape (verified against `calculateBCAPoints`):
 *
 *   milestone_target = round(games_to_win * milestone_percent)   // straight round
 *
 *   if games_won >= games_to_win:
 *     points = win_threshold_jump_value + (games_won - games_to_win) * per_game_increment
 *   else if games_won >= milestone_target:
 *     points = milestone_jump_value + (games_won - milestone_target) * per_game_increment
 *   else:
 *     points = games_won * per_game_increment
 *
 * **No tie-band rule.** The formula is monotonic — for any params,
 * points(N+1) >= points(N) for all N. Unlike `linear_above_threshold`,
 * `games_to_tie` is irrelevant; only `games_to_win` and the milestone
 * matter. This is fine for BCA 5v5 (25 games, odd, can't tie). If an LO
 * pairs this calculator with an even-game format that CAN tie, the combo
 * coherence validator (Phase 4 Unit 4.2) warns "this calculator doesn't
 * handle ties." See supplement Section 6.7.
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 1.3)
 */

import { z } from 'zod';
import type { AggregatePointsCalculator } from './types';

// ============================================================================
// Params
// ============================================================================

/**
 * Parameters for the `accumulate_with_milestone_jumps` calculator. Four
 * configurable values: a per-game baseline increment, a milestone percent
 * (where the first jump fires), the milestone jump value, and the win
 * threshold jump value.
 */
export interface MilestoneJumpsParams {
  /** Linear contribution per game won (default 0.1). */
  per_game_increment: number;
  /** Fraction of games_to_win where the milestone jump fires (default 0.7). */
  milestone_percent: number;
  /** Points value awarded at the milestone target (default 1.5). */
  milestone_jump_value: number;
  /** Points value awarded at the win threshold (default 3.0). */
  win_threshold_jump_value: number;
}

/**
 * zod schema. All four fields are finite numbers. We don't enforce ranges
 * (e.g., 0 <= milestone_percent <= 1) in the schema — combo-coherence
 * validation catches nonsensical configurations at the wizard level.
 */
export const milestoneJumpsParamSchema = z.object({
  per_game_increment: z.number().finite(),
  milestone_percent: z.number().finite(),
  milestone_jump_value: z.number().finite(),
  win_threshold_jump_value: z.number().finite(),
});

/** Tested Preset values (BCA 5v5 default — exact match for legacy `calculateBCAPoints`). */
export const MILESTONE_JUMPS_DEFAULT_PARAMS: MilestoneJumpsParams = {
  per_game_increment: 0.1,
  milestone_percent: 0.7,
  milestone_jump_value: 1.5,
  win_threshold_jump_value: 3.0,
};

// ============================================================================
// The math
// ============================================================================

function computePoints(
  gamesWon: number,
  gamesToWin: number,
  params: MilestoneJumpsParams,
): number {
  // Match legacy behavior: straight round (Math.round), not ceil.
  const milestoneTarget = Math.round(gamesToWin * params.milestone_percent);

  if (gamesWon >= gamesToWin) {
    // Win-threshold band — fixed jump + linear above.
    return (
      params.win_threshold_jump_value +
      (gamesWon - gamesToWin) * params.per_game_increment
    );
  }

  if (gamesWon >= milestoneTarget) {
    // Milestone band — fixed jump + linear above.
    return (
      params.milestone_jump_value +
      (gamesWon - milestoneTarget) * params.per_game_increment
    );
  }

  // Sub-milestone — pure linear from zero.
  return gamesWon * params.per_game_increment;
}

// ============================================================================
// Calculator
// ============================================================================

/**
 * The `accumulate_with_milestone_jumps` calculator. Aggregate-input.
 * Tested Preset value: BCA 5v5 default. Monotonic; no tie-band logic.
 */
export const accumulateWithMilestoneJumps: AggregatePointsCalculator<MilestoneJumpsParams> = {
  name: 'accumulate_with_milestone_jumps',
  kind: 'aggregate',
  defaultParams: MILESTONE_JUMPS_DEFAULT_PARAMS,
  paramSchema: milestoneJumpsParamSchema,

  // Aggregate calculator — the per-game popup only needs the implicit
  // winner picker. Achievement fields are league-preference-driven, separate.
  scoringPopupFields: () => ({ perSideInputs: null }),

  compute: ({ gamesWon, thresholds }, params) => {
    const parsed = milestoneJumpsParamSchema.safeParse(params);
    let resolvedParams: MilestoneJumpsParams;
    if (parsed.success) {
      resolvedParams = parsed.data;
    } else {
      console.warn(
        '[accumulate_with_milestone_jumps] params failed zod validation — falling back to default params (BCA 5v5)',
        { params, error: parsed.error.message },
      );
      resolvedParams = MILESTONE_JUMPS_DEFAULT_PARAMS;
    }

    if (thresholds.games_to_win == null) {
      console.warn(
        '[accumulate_with_milestone_jumps] thresholds.games_to_win is null — returning 0 points',
      );
      return 0;
    }

    return computePoints(gamesWon, thresholds.games_to_win, resolvedParams);
  },
};
