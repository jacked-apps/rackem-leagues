/**
 * @fileoverview FargoRate 10-Point 5-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README + the Ed-walked decomposition:
 *
 *   composition = (C) initial points (via receipt trigger pair)
 *               + (A) per-game allocator
 *
 * **Slice 4 of the Threshold refactor (2026-05-19):** migrated to data-driven
 * `ThresholdRow`s AND fixes Finding 2 from the architectural audit.
 *
 * **Finding 2 was real drift** — the previous initial-points thresholds
 * read pre-computed values from `inputs.prefs.initial_home` / `initial_away`,
 * making the caller responsible for running the FargoRate math externally.
 * This violated the "threshold is a pure function of match inputs" principle —
 * the threshold was just a pass-through, not actually doing computation.
 *
 * **Fix:** thresholds now reference the `fargo_start_points_for_side`
 * operation, which delegates to `fargoFormulaChart` for the calibrated
 * computation. The threshold consumes `homeRatings` + `awayRatings` from
 * runtime inputs and produces the start-points value if this side is the
 * weaker team, 0 otherwise. The math lives inside the threshold operation
 * where it belongs.
 *
 * Cross-audit updated to provide real rating arrays instead of pre-computed
 * start-points values.
 *
 * @see ../operations/fargo-start-points-for-side.ts — the FargoRate operation
 * @see src/systems/threshold-charts/fargo-formula.ts — the underlying chart
 */

// Importing these auto-registers the operations into the threshold registry.
import '../operations/fargo-start-points-for-side';

import { buildThresholdRow } from '../threshold-resolver';
import type { PointsSystem, Trigger } from '../types';

export interface Fargo10pt5ManParams {
  /** Default points awarded to the winner of each game (default 10). */
  winner_points: number;
  /** Min/max for the loser's counter input (default 0–7 for balls pocketed). */
  loser_min: number;
  loser_max: number;
  loser_label: string;
}

const DEFAULT_PARAMS: Fargo10pt5ManParams = {
  winner_points: 10,
  loser_min: 0,
  loser_max: 7,
  loser_label: 'Balls pocketed by loser',
};

/**
 * Build a receipt trigger that adds the named threshold's value to a
 * concrete points variable. Used for awarding the start-points head-start
 * at match start.
 */
function awardInitialPoints(
  triggerName: string,
  thresholdRef: string,
  targetVariable: string,
): Trigger {
  return {
    name: triggerName,
    when: { kind: 'receipt', thresholdRef },
    action: {
      target: { kind: 'concrete', variableName: targetVariable },
      op: 'add',
      value: { kind: 'threshold_ref', thresholdRef },
    },
  };
}

/**
 * Build the FargoRate 10-Point 5-Man Scoring System's Points System composition.
 *
 * Thresholds compute start-points from `inputs.homeRatings`/`awayRatings`
 * at evaluation time (no caller pre-computation needed).
 */
export function buildFargo10pt5ManComposition(
  params: Partial<Fargo10pt5ManParams> = {},
): PointsSystem {
  const p: Fargo10pt5ManParams = { ...DEFAULT_PARAMS, ...params };

  return {
    name: 'fargo_10pt_5man',
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
      name: 'fargo_per_game',
      winner: { kind: 'fixed', points: p.winner_points },
      loser: {
        kind: 'counter',
        min: p.loser_min,
        max: p.loser_max,
        label: p.loser_label,
      },
    },
    triggers: [
      awardInitialPoints('award_initial_home', 'initialHome', 'home_points'),
      awardInitialPoints('award_initial_away', 'initialAway', 'away_points'),
    ],
  };
}
