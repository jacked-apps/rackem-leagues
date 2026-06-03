/**
 * @fileoverview Threshold module: BCA 5v5 Percentage away-team threshold trio.
 *
 * Mirror of `homeThresholds.ts` for the away side. Never throws.
 */

import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';
import type { Module, StateBag } from '@/systems/chain-runtime/types';

export const awayThresholds: Module = {
  name: 'bca5v5.awayThresholds',
  run: (bag: StateBag) => {
    const diff = bag.away_handicap_diff;
    if (typeof diff !== 'number') {
      bag.away_to_win = null;
      bag.away_to_tie = null;
      bag.away_to_lose = null;
      return;
    }

    try {
      const trio = get5v5GamesNeeded(diff);
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
