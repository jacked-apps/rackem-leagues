/**
 * @fileoverview Apply-time preview for the league-settings picker.
 *
 * When the LO picks a saved variation for their league, this helper runs
 * `evaluatePointsSystem` against a SYNTHETIC match using the league's
 * prepackaged composition with the picked variation slotted in. Any
 * NaN/Infinity, negative-points, or thrown evaluation becomes a warning
 * the picker surfaces inline — the LO can Apply Anyway or cancel.
 *
 * This is the league-side complement to `saveTimeGuard` (which exercises
 * the variation in ISOLATION inside the editor). The league preview
 * exercises the variation AS IT WILL ACTUALLY RUN — bundled with the
 * league's chosen prepackaged composition (its triggers, its
 * thresholds). That's the only way to catch scale-mismatch warnings.
 */

import { evaluatePointsSystem } from '@/systems/points-system/runtime';
import { buildPoints3ManComposition } from '@/systems/points-system/compositions/points-3-man';
import { buildPercent5ManComposition } from '@/systems/points-system/compositions/percent-5-man';
import { buildTenPointComposition } from '@/systems/points-system/compositions/10-point';
import { validatePerGameAllocator } from '@/systems/points-system/composition-validator';
import type {
  PerGameAllocator,
  PointsSystem,
  ThresholdInputs,
} from '@/systems/points-system/types';

export type ApplyTimePreview =
  | { readonly ok: true; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Reasonable synthetic inputs that satisfy every prepackaged composition's
 * prefs lookups (e.g. Percent 5-Man reads `games_to_win` and
 * `milestone_percent` at match start from `prefs`).
 */
const SYNTHETIC_INPUTS: ThresholdInputs = {
  homeRatings: [500, 500, 500, 500, 500],
  awayRatings: [500, 500, 500, 500, 500],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 5,
  prefs: { games_to_win: 13, milestone_percent: 0.7 },
};

/** Build the league's prepackaged composition by `points_calculator`. */
function prepackaged(pointsCalculator: string | null): PointsSystem | null {
  if (pointsCalculator === 'linear_above_threshold') return buildPoints3ManComposition({ multiplier: 1 });
  if (pointsCalculator === 'accumulate_with_milestone_jumps') return buildPercent5ManComposition({});
  if (pointsCalculator === 'accumulated_per_game') return buildTenPointComposition({});
  return null;
}

/**
 * Preview the league's scoring with the picked variation slotted in.
 * Returns `ok: true` with a (possibly empty) warnings list, or
 * `ok: false` with a reason if evaluation could not proceed at all.
 */
export function runApplyTimePreview(
  pointsCalculator: string | null,
  pickedVariation: PerGameAllocator,
): ApplyTimePreview {
  // Structural check first — the workshop's save-time guard already ran
  // this, but a row could reach the league pick after direct-DB edits, or
  // the saved-row args could become invalid as new ops register. Catch it
  // here before the runtime hits a thrown compute.
  try {
    validatePerGameAllocator(pickedVariation);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  const baseline = prepackaged(pointsCalculator);
  if (!baseline) {
    return {
      ok: false,
      reason:
        'This league has no prepackaged scoring composition wired up yet. The pick is recorded but preview cannot run.',
    };
  }

  const composition: PointsSystem = {
    ...baseline,
    name: `${baseline.name}__preview_${pickedVariation.name}`,
    perGameAllocator: pickedVariation,
  };

  const warnings: string[] = [];
  try {
    const result = evaluatePointsSystem(composition, SYNTHETIC_INPUTS, [
      { winnerSide: 'home', winnerCounterInput: 3, loserCounterInput: 2 },
      { winnerSide: 'away', winnerCounterInput: 5, loserCounterInput: 0 },
      { winnerSide: 'home', winnerCounterInput: 0, loserCounterInput: 7 },
      { winnerSide: 'away', winnerCounterInput: 7, loserCounterInput: 4 },
      { winnerSide: 'home', winnerCounterInput: 4, loserCounterInput: 3 },
    ]);

    const home = result.home_points;
    const away = result.away_points;
    if (typeof home !== 'number' || !Number.isFinite(home)) {
      warnings.push(`Home totals came out non-finite (${String(home)}).`);
    }
    if (typeof away !== 'number' || !Number.isFinite(away)) {
      warnings.push(`Away totals came out non-finite (${String(away)}).`);
    }
    if (typeof home === 'number' && home < 0) {
      warnings.push(`Home totals went negative (${home}).`);
    }
    if (typeof away === 'number' && away < 0) {
      warnings.push(`Away totals went negative (${away}).`);
    }
  } catch (err) {
    return {
      ok: false,
      reason: `Preview threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ok: true, warnings };
}
