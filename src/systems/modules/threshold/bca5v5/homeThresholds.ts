/**
 * @fileoverview Threshold module: BCA 5v5 Percentage home-team threshold trio.
 *
 * Reads `home_handicap_diff` from the bag, looks up the 5v5 chart,
 * writes `home_to_win`, `home_to_tie`, `home_to_lose`.
 *
 * Different chart from BCA 3v3 — per principle 4 in CLAUDE.md,
 * different situations (3v3 vs 5v5) are different modules. Never
 * throws — writes nulls on any failure.
 */

import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';
import type { Module, StateBag } from '@/systems/chain-runtime/types';

export const homeThresholds: Module = {
  name: 'bca5v5.homeThresholds',
  run: (bag: StateBag) => {
    const diff = bag.home_handicap_diff;
    if (typeof diff !== 'number') {
      bag.home_to_win = null;
      bag.home_to_tie = null;
      bag.home_to_lose = null;
      return;
    }

    try {
      const trio = get5v5GamesNeeded(diff);
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
