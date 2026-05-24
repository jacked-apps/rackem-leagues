/**
 * @fileoverview Points handicap system — integer ±2 encoding (BCA 3v3).
 *
 * Per the locked Points variant page
 * (`docs/league-system/modules/handicap-systems/points.md`), Points is an
 * internally-computed rating in the -2..+2 integer range (standard) or
 * -1..+1 (reduced). Currently consumed by the BCA 3v3 prepackaged Scoring
 * System.
 *
 * Extracted in Phase A.1 of the Handicap Systems extraction Unit. Implementation
 * is byte-identical to the rating capability on `bca3v3.ts` — the
 * characterization tests in `src/systems/__tests__/bca3v3.characterization.test.ts`
 * (specifically the `rating.displayFormat` and `rating.validate` sections) will
 * also exercise this code after Phase B wires the Module into SystemModule
 * alongside the existing `rating` field.
 *
 * @see docs/league-system/modules/handicap-systems/points.md — the locked blueprint
 */

import type { HandicapSystem } from './types';

/**
 * Points handicap encoding (integer ±2).
 *
 * - `kind: 'points'` — discriminator for selection-pattern routing
 * - `requiresManualEntry: false` — derived from match history, not manually entered
 * - `displayFormat`: `+2`, `-1`, `0` (positive values get explicit `+` sign)
 * - `validate`: rejects non-numbers, non-integers, and values outside [-2, 2]
 * - `computeFromHistory`: intentionally omitted in Phase A — the existing async
 *   `calculatePlayerHandicap()` in `src/utils/calculatePlayerHandicap.ts` continues
 *   to own that logic. A future Unit may lift it into this Module once the async/DB
 *   concerns are handled cleanly.
 */
export const pointsHandicapSystem: HandicapSystem = {
  kind: 'points',

  requiresManualEntry: false,

  displayFormat: (value) => {
    if (value > 0) return `+${value}`;
    return String(value);
  },

  validate: (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, message: 'Rating must be a number' };
    }
    if (!Number.isInteger(value)) {
      return { ok: false, message: 'Points handicap must be an integer' };
    }
    if (value < -2 || value > 2) {
      return { ok: false, message: 'Points handicap must be between -2 and +2' };
    }
    return { ok: true, value };
  },
};
