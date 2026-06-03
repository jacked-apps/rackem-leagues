/**
 * @fileoverview Threshold module: BCA 3v3 home-team threshold trio.
 *
 * Reads `home_handicap_diff` from the bag, looks up the 3v3 chart,
 * writes the home team's three threshold values:
 * - `home_to_win` (number)
 * - `home_to_tie` (number | null)
 * - `home_to_lose` (number)
 *
 * Per principle 4 in CLAUDE.md, one chart lookup is one coherent
 * computation — the three values it produces belong to the same
 * module. (Counterpart: `awayThresholds.ts` for the opposite side.)
 *
 * Never throws. If the diff is missing or the chart lookup fails,
 * writes nulls and continues.
 */

import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import type { Module, StateBag } from '@/systems/chain-runtime/types';

export const homeThresholds: Module = {
  name: 'bca3v3.homeThresholds',
  run: (bag: StateBag) => {
    const diff = bag.home_handicap_diff;
    if (typeof diff !== 'number') {
      bag.home_to_win = null;
      bag.home_to_tie = null;
      bag.home_to_lose = null;
      return;
    }

    try {
      const trio = get3v3GamesNeeded(diff);
      bag.home_to_win = trio.games_to_win;
      bag.home_to_tie = trio.games_to_tie;
      bag.home_to_lose = trio.games_to_lose;
    } catch {
      bag.home_to_win = null;
      bag.home_to_tie = null;
      bag.home_to_lose = null;
    }
  },
};
