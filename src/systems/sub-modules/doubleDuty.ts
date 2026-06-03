/**
 * @fileoverview Double-Duty SubModule — a real lineup player plays a
 * second slot too. Opposing captain resolves which player when both
 * lineups lock.
 *
 * Persisted as the double-duty sentinel UUID via
 * `getDoubleDutySubId(...)` in
 * `src/utils/lineup/substituteHelpers.ts`.
 */

import type { SubModule } from './types';

export const doubleDutySubModule: SubModule = {
  kind: 'double_duty',
  displayLabel: 'Double Duty',
  dropdownValue: '__double_duty__',
  maxPerLineup: 1,
};
