/**
 * @fileoverview Percentage handicap system — 0–100 encoding (BCA 5v5).
 *
 * Per the locked Percentage variant page
 * (`docs/league-system/modules/handicap-systems/percentage.md`), Percentage is an
 * internally-computed rating in the 0–100 range. Currently consumed by the
 * BCA 5v5 prepackaged Scoring System.
 *
 * Extracted in Phase A of the Handicap Systems extraction Unit. Implementation
 * is byte-identical to the rating capability on `bca5v5.ts`.
 *
 * @see docs/league-system/modules/handicap-systems/percentage.md — the locked blueprint
 */

import type { HandicapSystem } from './types';

/**
 * Percentage handicap encoding (0–100).
 *
 * - `kind: 'percentage'` — discriminator for selection-pattern routing
 * - `requiresManualEntry: false` — derived from match history, not manually entered
 * - `displayFormat`: `85%`, `30%` (rounded to nearest integer with percent sign)
 * - `validate`: rejects non-numbers and values outside [0, 100]
 * - `computeFromHistory`: intentionally omitted in Phase A — the existing async
 *   `calculatePlayerHandicap()` continues to own that logic.
 */
export const percentageHandicapSystem: HandicapSystem = {
  kind: 'percentage',

  requiresManualEntry: false,

  displayFormat: (value) => `${Math.round(value)}%`,

  validate: (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, message: 'Rating must be a number' };
    }
    if (value < 0 || value > 100) {
      return { ok: false, message: 'Percentage handicap must be between 0 and 100' };
    }
    return { ok: true, value };
  },
};
