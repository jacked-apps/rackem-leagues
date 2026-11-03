/**
 * @fileoverview Individual-award helpers for the payout calculator: id
 * generation and the default starter awards.
 *
 * Kept out of `IndividualAwardsEditor.tsx` so that file exports only its
 * component (keeps React fast-refresh working).
 */

import type { IndividualAward } from '@/utils/finances';

export const newAwardId = () => `award-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Default starter awards seeded into a new calculator session. */
export function defaultIndividualAwards(): IndividualAward[] {
  return [
    { id: newAwardId(), label: '🏆 Top Shooter', amount: 100, loFunded: false },
    { id: newAwardId(), label: '🎁 Outstanding Achievement', amount: 50, loFunded: true },
  ];
}
