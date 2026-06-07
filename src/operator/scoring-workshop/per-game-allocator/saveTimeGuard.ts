/**
 * @fileoverview Save-time guard for the per-game allocator room editor.
 *
 * The first of four guard layers between a saved row and the runtime (the
 * others: read-time validator in the loader, snapshot freeze at match
 * start, runtime backstop around the allocator call). This guard fires
 * the moment the user clicks Save in the editor — it refuses to persist
 * anything the validator rejects or that throws during a dry-run.
 *
 * Two checks, in order:
 *
 *   1. **Structural — `validatePerGameAllocator`.** Unit 3's tightened
 *      validator. Catches missing required formula args, type mismatches,
 *      side_name out-of-range, unregistered operations.
 *   2. **Dry-run — small synthetic match through `evaluatePointsSystem`.**
 *      Catches throws the structural validator can't see (e.g., a divide
 *      that explodes at compute time, an arithmetic op that NaNs).
 *
 * Both checks are wrapped never-throw — the guard returns a structured
 * `{ ok, reason? }` result so the editor can render the error inline
 * without the page crashing.
 */

import { validatePerGameAllocator } from '@/systems/points-system/composition-validator';
import { evaluatePointsSystem } from '@/systems/points-system/runtime';
import type {
  PerGameAllocator,
  PointsSystem,
  ThresholdInputs,
} from '@/systems/points-system/types';

export type SaveTimeGuardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

const SYNTHETIC_INPUTS: ThresholdInputs = {
  homeRatings: [500, 500, 500, 500, 500],
  awayRatings: [500, 500, 500, 500, 500],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 5,
  prefs: {},
};

/**
 * Run the save-time checks against a candidate variation. Returns `{ ok: true }`
 * when the variation is safe to persist, or `{ ok: false, reason }` with a
 * human-readable explanation the editor can surface inline.
 */
export function runSaveTimeGuard(
  allocator: PerGameAllocator,
): SaveTimeGuardResult {
  // 1. Structural validation.
  try {
    validatePerGameAllocator(allocator);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Dry-run: 5 synthetic games (alternating winners) through a stub
  //    composition containing ONLY this allocator. No thresholds, no
  //    triggers, no league state — pure exercise of the allocator path.
  const stub: PointsSystem = {
    name: `__save_time_guard__${allocator.name}`,
    thresholds: {},
    perGameAllocator: allocator,
    triggers: [],
  };
  try {
    const result = evaluatePointsSystem(stub, SYNTHETIC_INPUTS, [
      { winnerSide: 'home', winnerCounterInput: 3, loserCounterInput: 2 },
      { winnerSide: 'away', winnerCounterInput: 5, loserCounterInput: 0 },
      { winnerSide: 'home', winnerCounterInput: 0, loserCounterInput: 7 },
      { winnerSide: 'away', winnerCounterInput: 7, loserCounterInput: 4 },
      { winnerSide: 'home', winnerCounterInput: 4, loserCounterInput: 3 },
    ]);
    // Sanity: totals must be finite. The runtime's Unit 4 backstop catches
    // throws inside the allocator, but a recipe that returns NaN/Infinity
    // would silently poison the totals — surface that here.
    const home = result.home_points;
    const away = result.away_points;
    if (typeof home !== 'number' || !Number.isFinite(home)) {
      return {
        ok: false,
        reason: `Dry-run produced non-finite home_points (${String(home)}).`,
      };
    }
    if (typeof away !== 'number' || !Number.isFinite(away)) {
      return {
        ok: false,
        reason: `Dry-run produced non-finite away_points (${String(away)}).`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      reason: `Dry-run threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ok: true };
}
