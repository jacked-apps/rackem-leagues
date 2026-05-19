/**
 * @fileoverview 10-Point Scoring System — Points System composition.
 *
 * Per the official CSI / BCAPL / FargoRate terminology, this is the
 * **10-Point Scoring System** — the points format where each game awards
 * 10 points to the winner plus a counter (0-7 balls pocketed) to the loser.
 * FargoRate is a SEPARATE rating system that can be applied on top of this
 * scoring format to provide handicapping (see `fargo_start_points_for_side`
 * operation); the points format itself is just "10-Point."
 *
 * Per the locked Points System README + the Ed-walked decomposition:
 *
 *   composition = (C) initial points (via receipt trigger pair)
 *               + (A) per-game allocator
 *
 * Thresholds compute start-points from lineup ratings via the
 * FargoFormulaChart at evaluation time (no caller pre-computation needed).
 *
 * **Size-agnostic.** The 10-Point per-game allocator (`winner: fixed 10`,
 * `loser: counter 0..7`) doesn't depend on lineup size. The threshold
 * operation `fargo_start_points_for_side` declares `consumesSize: 'any'`.
 * One composition handles 5v5, 3v3, or any other roster size.
 *
 * @see ../operations/fargo-start-points-for-side.ts — the FargoRate start-points operation
 * @see src/systems/threshold-charts/fargo-formula.ts — the underlying chart
 */

// Importing these auto-registers the operations into the threshold registry.
import '../operations/fargo-start-points-for-side';

import { validatePointsSystem } from '../composition-validator';
import { buildThresholdRow } from '../threshold-resolver';
import type { PointsSystem, Trigger } from '../types';

export interface TenPointParams {
  /** Default points awarded to the winner of each game (default 10). */
  winner_points: number;
  /** Min/max for the loser's counter input (default 0–7 for balls pocketed). */
  loser_min: number;
  loser_max: number;
  loser_label: string;
}

const DEFAULT_PARAMS: TenPointParams = {
  winner_points: 10,
  loser_min: 0,
  loser_max: 7,
  loser_label: 'Balls pocketed by loser',
};

/**
 * Build a receipt trigger that adds the trigger's bound input value (the
 * named threshold's resolved value, `n`) to a concrete points variable.
 * Used for awarding the start-points head-start at match start.
 */
function awardInitialPoints(
  triggerName: string,
  thresholdRef: string,
  side: 'home' | 'away',
  targetVariable: string,
): Trigger {
  return {
    name: triggerName,
    input: { thresholdRef },
    inputSpec: { outputType: 'points_headstart', outputSide: side },
    when: { kind: 'receipt' },
    action: {
      target: { kind: 'concrete', variableName: targetVariable },
      op: 'add',
      value: { kind: 'input_ref' },
    },
  };
}

/**
 * Build the 10-Point Scoring System's Points System composition.
 *
 * Thresholds compute start-points from `inputs.homeRatings`/`awayRatings`
 * at evaluation time (no caller pre-computation needed).
 */
export function buildTenPointComposition(
  params: Partial<TenPointParams> = {},
): PointsSystem {
  const p: TenPointParams = { ...DEFAULT_PARAMS, ...params };

  const composition: PointsSystem = {
    name: '10_point',
    thresholds: {
      // Start-points per side. Operation runs the FargoRate formula and returns
      // the start-points value if this side is the weaker team, 0 otherwise.
      // Math lives inside the threshold; no caller pre-computation.
      initialHome: buildThresholdRow({
        name: 'initialHome',
        operationKind: 'fargo_start_points_for_side',
        operationArgs: { side: 'home' },
      }),
      initialAway: buildThresholdRow({
        name: 'initialAway',
        operationKind: 'fargo_start_points_for_side',
        operationArgs: { side: 'away' },
      }),
    },
    perGameAllocator: {
      name: '10pt_per_game',
      winner: { kind: 'fixed', points: p.winner_points },
      loser: {
        kind: 'counter',
        min: p.loser_min,
        max: p.loser_max,
        label: p.loser_label,
      },
    },
    triggers: [
      awardInitialPoints('award_initial_home', 'initialHome', 'home', 'home_points'),
      awardInitialPoints('award_initial_away', 'initialAway', 'away', 'away_points'),
    ],
  };

  validatePointsSystem(composition);
  return composition;
}
