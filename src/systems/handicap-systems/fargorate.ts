/**
 * @fileoverview FargoRate handicap system — integer 100–850 encoding (FargoRate 10-Point 5-Man).
 *
 * Per the locked FargoRate variant page
 * (`docs/league-system/modules/handicap-systems/fargorate.md`), FargoRate is an
 * externally-sourced rating in the 100–850 integer range. Operators manually enter
 * the value at lineup-lock time (until FargoRate API access lands).
 *
 * Extracted in Phase A of the Handicap Systems extraction Unit. Implementation is
 * byte-identical to the rating capability on `fargo5v5.ts`.
 *
 * @see docs/league-system/modules/handicap-systems/fargorate.md — the locked blueprint
 */

import type { RatingValidationResult } from '../types';
import type { HandicapSystem } from './types';

const FARGO_RATING_MIN = 100;
const FARGO_RATING_MAX = 850;

function formatFargo(value: number): string {
  return String(Math.round(value));
}

/**
 * Validate a FargoRate rating value. Must be a finite integer in [100, 850].
 *
 * Extracted from `fargo5v5.ts`'s `validateRating` function to keep the Module
 * implementation self-contained.
 */
function validateRating(value: unknown): RatingValidationResult {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, message: 'Fargo rating must be a number' };
  }
  if (!Number.isInteger(value)) {
    return { ok: false, message: 'Fargo rating must be a whole integer' };
  }
  if (value < FARGO_RATING_MIN || value > FARGO_RATING_MAX) {
    return {
      ok: false,
      message: `Fargo rating must be between ${FARGO_RATING_MIN} and ${FARGO_RATING_MAX}`,
    };
  }
  return { ok: true, value };
}

/**
 * FargoRate handicap encoding (integer 100–850).
 *
 * - `kind: 'fargo'` — discriminator for selection-pattern routing
 * - `requiresManualEntry: true` — externally-sourced; operator enters at lineup-lock
 * - `displayFormat`: `575`, `425` (rounded to nearest integer, no decoration)
 * - `validate`: rejects non-numbers, non-integers, and values outside [100, 850]
 * - `computeFromHistory`: returns null (FargoRate has no history-based derivation
 *   in this app — ratings come from the external FargoRate organization)
 */
export const fargoRateHandicapSystem: HandicapSystem = {
  kind: 'fargo',

  requiresManualEntry: true,

  computeFromHistory: () => null,

  displayFormat: formatFargo,

  validate: validateRating,

  // Lineup-page entry dials. Per Ed's reframing: Fargo today is the
  // manual-entry module with Fargo dials. When the FargoRate API
  // access lands, flip `source` to 'api' and wire an adapter. Range
  // 100–1000 (above the 850 strict ceiling; the strict contract is
  // enforced by `validate` above). See ./handicapEntry.ts.
  handicapEntry: {
    inputKind: 'number',
    range: { min: FARGO_RATING_MIN, max: FARGO_RATING_MAX, integer: true },
    enumValues: null,
    placeholderText: '—',
    columnHeader: 'Fargo',
    columnWidth: 'wide',
    displayFormat: (value) => (value === null ? '' : formatFargo(value)),
    source: 'manual',
    unitSuffix: '',
    subPlaceholderValue: null,
  },
};
