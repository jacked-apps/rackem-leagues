/**
 * @fileoverview Skill Level handicap system — RESERVED (APA SL 1–9).
 *
 * Per the locked Skill Level variant page
 * (`docs/league-system/modules/handicap-systems/skill-level.md`), Skill Level is
 * an externally-sourced rating in the 1–9 integer range used by APA leagues.
 * Currently RESERVED — no shipping Scoring System uses Skill Level, and no
 * historical-derivation formula is implemented.
 *
 * This file ships a minimal Module so the Handicap Systems registry has a complete
 * 4-variant surface. Operators selecting `handicap_type='skill_level'` would get
 * this Module, with the same shape as the other variants but no real
 * `computeFromHistory` and minimal validation.
 *
 * @see docs/league-system/modules/handicap-systems/skill-level.md — the locked blueprint
 */

import type { HandicapSystem } from './types';

const SKILL_LEVEL_MIN = 1;
const SKILL_LEVEL_MAX = 9;

function formatSkillLevel(value: number): string {
  return `SL${Math.round(value)}`;
}

/**
 * Skill Level handicap encoding (integer 1–9) — RESERVED, no shipping consumer.
 *
 * - `kind: 'skill_level'` — discriminator for selection-pattern routing
 * - `requiresManualEntry: true` — externally-sourced (APA assigns the level);
 *   would be operator-entered until any APA integration ships
 * - `displayFormat`: `SL5`, `SL8` (the `SL` prefix is the APA convention)
 * - `validate`: rejects non-numbers, non-integers, and values outside [1, 9]
 * - `computeFromHistory`: undefined (no history-based derivation for this encoding)
 */
export const skillLevelHandicapSystem: HandicapSystem = {
  kind: 'skill_level',

  requiresManualEntry: true,

  displayFormat: formatSkillLevel,

  validate: (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, message: 'Skill Level must be a number' };
    }
    if (!Number.isInteger(value)) {
      return { ok: false, message: 'Skill Level must be a whole integer' };
    }
    if (value < SKILL_LEVEL_MIN || value > SKILL_LEVEL_MAX) {
      return {
        ok: false,
        message: `Skill Level must be between ${SKILL_LEVEL_MIN} and ${SKILL_LEVEL_MAX}`,
      };
    }
    return { ok: true, value };
  },

  // Lineup-page entry dials. Reserved; not in any shipping system
  // today. Configured as a number widget bounded to 1–9 (APA's
  // skill-level range) since the future expectation is operator
  // entry (APA assigns the level externally).
  handicapEntry: {
    inputKind: 'number',
    range: { min: SKILL_LEVEL_MIN, max: SKILL_LEVEL_MAX, integer: true },
    enumValues: null,
    placeholderText: 'SL',
    columnHeader: 'Skill',
    columnWidth: 'narrow',
    displayFormat: (value) => (value === null ? '' : formatSkillLevel(value)),
    source: 'manual',
  },
};
