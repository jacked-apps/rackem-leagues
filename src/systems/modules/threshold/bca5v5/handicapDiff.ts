/**
 * @fileoverview Threshold module: BCA 5v5 Percentage handicap differential.
 *
 * Sister of `bca3v3/handicapDiff.ts` minus the team bonus — percentage
 * handicaps don't carry a standings bonus.
 *
 * Reads `home_handicaps` and `away_handicaps` from the bag. Writes:
 * - `home_handicap_diff` (number): homeTotal − awayTotal
 * - `away_handicap_diff` (number): awayTotal − homeTotal
 *
 * Never throws.
 */

import type { Module, StateBag } from '@/systems/chain-runtime/types';

function sum(values: unknown): number {
  if (!Array.isArray(values)) return 0;
  return values.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
}

export const handicapDiff: Module = {
  name: 'bca5v5.handicapDiff',
  run: (bag: StateBag) => {
    const homeTotal = sum(bag.home_handicaps);
    const awayTotal = sum(bag.away_handicaps);
    bag.home_handicap_diff = homeTotal - awayTotal;
    bag.away_handicap_diff = awayTotal - homeTotal;
  },
};
