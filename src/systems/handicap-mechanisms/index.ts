/**
 * @fileoverview Handicap Mechanisms registry + public exports.
 *
 * Unlike the other Module registries (Handicap Systems, Threshold Charts),
 * Mechanism variants are FACTORIES, not pre-built instances — each variant
 * needs a Chart bound at construction time. The registry is therefore a
 * dispatcher that takes (mechanismKind, chart) and returns the appropriate
 * Mechanism instance.
 *
 * Phase A of the Handicap Mechanisms extraction (following the proven
 * strangler-fig pattern): create the Module's interface + variant factories
 * in isolation, no consumer changes. Phase B wires `handicapMechanism:
 * HandicapMechanism | null` into SystemModule alongside the existing
 * `threshold` capability. Phase C swaps consumers; Phase D removes the
 * legacy `threshold` field (which has been carrying the mode discriminator
 * since Threshold Charts Phase D collapsed the duplicate chart code).
 *
 * @see ./types.ts — the type definitions
 * @see docs/league-system/modules/handicap-mechanisms/README.md — locked blueprint
 */

import type {
  FargoFormulaChart,
  GamesNeededChart,
  RaceLengthChart,
} from '../threshold-charts/types';
import { createExtraGamesMechanism } from './extra-games';
import { createStartPointsMechanism } from './start-points';
import { createRaceLengthAdjustmentMechanism } from './race-length-adjustment';
import type {
  ExtraGamesMechanism,
  HandicapMechanism,
  MechanismKind,
  RaceLengthAdjustmentMechanism,
  StartPointsMechanism,
} from './types';

/**
 * Build a Handicap Mechanism instance for the given mechanism kind + chart.
 *
 * Dispatch is by `mechanismKind`. The `chart` parameter is typed as the
 * appropriate Chart variant per the kind (the dispatcher uses runtime
 * narrowing). Callers that already have a typed Chart should call the
 * variant-specific factory directly.
 *
 * For `'none'` league configs, use `noneMechanism` directly (it's not built
 * from a chart — it's a pre-made zero-handicap ExtraGamesMechanism instance).
 *
 * @param mechanismKind One of the 3 shipping kinds.
 * @param chart The Chart variant bound to this Mechanism instance.
 * @returns A HandicapMechanism instance ready to feed into SystemModule.
 */
export function buildHandicapMechanism(
  mechanismKind: 'extra_games',
  chart: GamesNeededChart,
): ExtraGamesMechanism;
export function buildHandicapMechanism(
  mechanismKind: 'start_points',
  chart: FargoFormulaChart,
): StartPointsMechanism;
export function buildHandicapMechanism(
  mechanismKind: 'race_length_adjustment',
  chart: RaceLengthChart,
): RaceLengthAdjustmentMechanism;
export function buildHandicapMechanism(
  mechanismKind: MechanismKind,
  chart: GamesNeededChart | FargoFormulaChart | RaceLengthChart,
): HandicapMechanism {
  switch (mechanismKind) {
    case 'extra_games':
      return createExtraGamesMechanism(chart as GamesNeededChart);
    case 'start_points':
      return createStartPointsMechanism(chart as FargoFormulaChart);
    case 'race_length_adjustment':
      return createRaceLengthAdjustmentMechanism(chart as RaceLengthChart);
  }
}

// Re-exports for convenience: `import { ... } from '@/systems/handicap-mechanisms'`.
export type {
  HandicapMechanism,
  MechanismKind,
  ExtraGamesMechanism,
  StartPointsMechanism,
  RaceLengthAdjustmentMechanism,
} from './types';
export {
  createExtraGamesMechanism,
  noneMechanism,
} from './extra-games';
export { createStartPointsMechanism } from './start-points';
export { createRaceLengthAdjustmentMechanism } from './race-length-adjustment';
