/**
 * @fileoverview Threshold module: BCA 3v3 away-team threshold trio.
 *
 * Mirror of `homeThresholds.ts` for the away side. Reads
 * `away_handicap_diff` from the bag, looks up the 3v3 chart, writes:
 * - `away_to_win` (number)
 * - `away_to_tie` (number | null)
 * - `away_to_lose` (number)
 *
 * Never throws — writes nulls on any failure.
 */

import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import type { Module, StateBag } from '@/systems/chain-runtime/types';

export const awayThresholds: Module = {
  name: 'bca3v3.awayThresholds',
  run: (bag: StateBag) => {
    const diff = bag.away_handicap_diff;
    if (typeof diff !== 'number') {
      bag.away_to_win = null;
      bag.away_to_tie = null;
      bag.away_to_lose = null;
      return;
    }

    try {
      const trio = get3v3GamesNeeded(diff);
      bag.away_to_win = trio.games_to_win;
      bag.away_to_tie = trio.games_to_tie;
      bag.away_to_lose = trio.games_to_lose;
    } catch {
      bag.away_to_win = null;
      bag.away_to_tie = null;
      bag.away_to_lose = null;
    }
  },
};
