/**
 * @fileoverview Handicap Systems registry + public exports.
 *
 * `getHandicapSystem(handicapType)` is the runtime entry point for selecting which
 * Handicap System variant a league uses. The resolver (`buildSystemFromPreferences`)
 * calls this when assembling the SystemModule for a league.
 *
 * Phase A of the Handicap Systems extraction (following the Team Geometry / Match
 * Format extraction pattern): create the Module's interface + 4 variant implementations
 * in isolation, no consumer changes. Phase B wires `handicapSystem: HandicapSystem` into
 * SystemModule alongside the existing `rating` field. Phase C swaps consumers from
 * `systemModule.rating.X` to `systemModule.handicapSystem.X`. Phase D removes the legacy
 * `rating` field.
 *
 * @see ./types.ts — the type definitions
 * @see docs/league-system/modules/handicap-systems/README.md — the locked blueprint
 */

import type { HandicapSystem, HandicapType } from './types';
import { pointsHandicapSystem } from './points';
import { percentageHandicapSystem } from './percentage';
import { fargoRateHandicapSystem } from './fargorate';
import { skillLevelHandicapSystem } from './skill-level';

/**
 * Look up a Handicap System Module by the `handicap_type` preference value.
 *
 * @param handicapType The league's `handicap_type` preference value
 *   (`'points' | 'percentage' | 'fargo' | 'skill_level'`).
 * @returns The corresponding Handicap System Module.
 *
 * Strict: throws if `handicapType` is not one of the four known values. Callers
 * are expected to have validated the preference at write-time; an unknown value
 * here is a contract violation (DB CHECK constraint should have caught it).
 */
export function getHandicapSystem(handicapType: HandicapType): HandicapSystem {
  switch (handicapType) {
    case 'points':
      return pointsHandicapSystem;
    case 'percentage':
      return percentageHandicapSystem;
    case 'fargo':
      return fargoRateHandicapSystem;
    case 'skill_level':
      return skillLevelHandicapSystem;
  }
}

// Re-exports for convenience: `import { ... } from '@/systems/handicap-systems'`.
export type { HandicapSystem, HandicapType } from './types';
export { pointsHandicapSystem } from './points';
export { percentageHandicapSystem } from './percentage';
export { fargoRateHandicapSystem } from './fargorate';
export { skillLevelHandicapSystem } from './skill-level';
