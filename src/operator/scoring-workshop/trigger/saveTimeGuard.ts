/**
 * @fileoverview Save-time guard for the trigger room editor.
 *
 * Mirrors the per-game allocator's `saveTimeGuard.ts` in shape. First
 * of four guard layers between a saved row and the runtime (the others:
 * read-time validator in `loadTrigger`, snapshot freeze at scoring
 * system assembly, runtime backstop inside `fireTrigger`).
 *
 * Two checks, in order:
 *
 *   1. **Structural — `validateTrigger`** with the trigger room's v1
 *      write-target whitelist (`home_points` / `away_points`). Catches
 *      empty names, bad types, malformed condition/action shapes, and
 *      writes to disallowed targets.
 *
 *   2. **Dry-run — synthetic match through `evaluatePointsSystem`.**
 *      Catches throws the structural validator can't see (e.g., an
 *      expression that divides by zero against the synthetic state bag).
 *      Builds a stub composition containing ONLY this trigger and
 *      exercises the relevant phase.
 *
 * Both checks are wrapped never-throw — the guard returns a structured
 * `{ ok, reason? }` result so the editor can render the error inline
 * without the page crashing.
 */

import { validateTrigger } from '@/systems/points-system/composition-validator';
import { evaluatePointsSystem } from '@/systems/points-system/runtime';
import type {
  PointsSystem,
  ThresholdInputs,
  Trigger,
} from '@/systems/points-system/types';
import { TRIGGER_WRITE_TARGETS } from './availableData';

export type SaveTimeGuardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

const ALLOWED_TARGETS = TRIGGER_WRITE_TARGETS.map((t) => t.name);

const SYNTHETIC_INPUTS: ThresholdInputs = {
  homeRatings: [500, 500, 500, 500, 500],
  awayRatings: [500, 500, 500, 500, 500],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 5,
  prefs: {},
};

const SYNTHETIC_GAMES = [
  { winnerSide: 'home', winnerCounterInput: 3, loserCounterInput: 2 },
  { winnerSide: 'away', winnerCounterInput: 5, loserCounterInput: 0 },
  { winnerSide: 'home', winnerCounterInput: 0, loserCounterInput: 7 },
  { winnerSide: 'away', winnerCounterInput: 7, loserCounterInput: 4 },
  { winnerSide: 'home', winnerCounterInput: 4, loserCounterInput: 3 },
] as const;

/**
 * Run the save-time checks against a candidate trigger. Returns
 * `{ ok: true }` when the trigger is safe to persist, or
 * `{ ok: false, reason }` with a human-readable explanation.
 */
export function runSaveTimeGuard(trigger: Trigger): SaveTimeGuardResult {
  // 1. Structural validation with the v1 write-target whitelist.
  try {
    validateTrigger(trigger, { allowedTargets: ALLOWED_TARGETS });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Dry-run: stub composition with this trigger as its only one.
  const stub: PointsSystem = {
    name: `__save_time_guard__${trigger.name}`,
    thresholds: {},
    triggers: [trigger],
  };
  try {
    evaluatePointsSystem(stub, SYNTHETIC_INPUTS, SYNTHETIC_GAMES);
  } catch (err) {
    return {
      ok: false,
      reason: `Dry-run threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ok: true };
}
