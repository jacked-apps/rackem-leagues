/**
 * @fileoverview Anonymous SubModule — captain picks "sub" for a slot
 * and enters the handicap themselves. The actual player isn't named.
 *
 * Persisted as the anonymous sentinel UUID via `getAnonSubId(...)`
 * in `src/utils/lineup/substituteHelpers.ts`.
 */

import type { SubModule } from './types';

export const anonymousSubModule: SubModule = {
  kind: 'anonymous',
  displayLabel: 'Anonymous Sub',
  // Matches the legacy dropdown value the existing MatchLineup logic
  // decodes back to a sentinel UUID. Keeping the value stable means
  // no changes to `handlePlayerChange`'s decode switch.
  dropdownValue: '__anonymous_sub__',
  maxPerLineup: 1,
};
