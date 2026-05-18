/**
 * @fileoverview FargoRate 10-Point 5-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README + the Ed-walked decomposition:
 *
 *   composition = (C) initial points (via receipt trigger pair)
 *               + (A) per-game allocator
 *
 * Where:
 * - (C) initial points: two receipt triggers (one per side), each consulting
 *   a threshold that returns the handicap-driven start-points value for that
 *   side. Per D3 dual-identity resolution: the threshold delegates to the
 *   FargoFormulaChart (or the active Handicap Mechanism's start_points
 *   compute). Phase A's cross-audit just uses literal pre-computed values
 *   from the test fixture, since the chart wiring is tested separately.
 * - (A) per-game allocator: winner = 10 fixed, loser = counter 0–7 (balls pocketed)
 *
 * Cross-audited against the legacy `accumulated_per_game` bundled calculator
 * (`src/systems/calculators/accumulated_per_game.ts`) for the per-game portion;
 * initial points behavior verified by composition tests (start_points adds
 * before per-game accumulation).
 *
 * @see ./points-3-man.ts ./percent-5-man.ts — sibling compositions
 */

import { computedThreshold } from '../threshold-helpers';
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
 * Inputs the Fargo initial-points thresholds need. The threshold compute
 * functions receive `ThresholdInputs` and read these via the `prefs` bag —
 * cleaner than extending `ThresholdInputs` with Fargo-specific fields
 * (which would mix concerns).
 *
 * For Phase A, the caller pre-computes the start-points values (typically
 * via the existing FargoFormulaChart or `fargo5v5.handicapMechanism.compute`)
 * and provides them as prefs.
 */
export interface FargoInitialPointsInputs {
  initial_home: number;
  initial_away: number;
}

/**
 * Build a receipt trigger that adds the named threshold's value to a
 * concrete points variable.
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
 * The initial-points thresholds read `initial_home` / `initial_away` from
 * the prefs bag — the caller (typically the resolver) is responsible for
 * pre-computing these via the active Handicap Mechanism's start_points logic.
 */
export function buildFargo10pt5ManComposition(
  params: Partial<Fargo10pt5ManParams> = {},
): PointsSystem {
  const p: Fargo10pt5ManParams = { ...DEFAULT_PARAMS, ...params };

  return {
    name: 'fargo_10pt_5man',
    thresholds: {
      // Initial points per side: read from the prefs bag. Caller pre-computes.
      initialHome: computedThreshold('initialHome', (inputs) => {
        const v = inputs.prefs.initial_home;
        return typeof v === 'number' && Number.isFinite(v) ? v : 0;
      }),
      initialAway: computedThreshold('initialAway', (inputs) => {
        const v = inputs.prefs.initial_away;
        return typeof v === 'number' && Number.isFinite(v) ? v : 0;
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
