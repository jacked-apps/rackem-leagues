/**
 * @fileoverview Threshold module: Fargo games-won thresholds.
 *
 * Reads `home_handicaps`, `away_handicaps`, and `total_games` from
 * the bag. Calls the existing `computeFargoGamesWonThresholds` helper
 * (which uses the canonical T = 2^(rating/100) primitive against the
 * full lineup ratings) and writes all six threshold values to the bag
 * in one shot.
 *
 * Per the second-pivot decision in the plan: the helper computes all
 * six values from one math pass, so this module wraps that one
 * computation. Future workshop edits could split it into six modules
 * if needed; for now the one-call-six-outputs shape mirrors the
 * underlying math.
 *
 * Writes: `home_to_win`, `home_to_tie`, `home_to_lose`, `away_to_win`,
 * `away_to_tie`, `away_to_lose`. Never throws — writes nulls on any
 * failure (empty lineups, non-finite ratings, etc.).
 */

import { computeFargoGamesWonThresholds } from '@/utils/handicap/fargoGamesWonThresholds';
import type { Module, StateBag } from '@/systems/chain-runtime/types';

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === 'number');
}

function writeAllNulls(bag: StateBag): void {
  bag.home_to_win = null;
  bag.home_to_tie = null;
  bag.home_to_lose = null;
  bag.away_to_win = null;
  bag.away_to_tie = null;
  bag.away_to_lose = null;
}

export const thresholds: Module = {
  name: 'fargoGames.thresholds',
  run: (bag: StateBag) => {
    const homeRatings = asNumberArray(bag.home_handicaps);
    const awayRatings = asNumberArray(bag.away_handicaps);
    const totalGames = typeof bag.total_games === 'number' ? bag.total_games : 0;

    if (homeRatings.length === 0 || awayRatings.length === 0 || totalGames <= 0) {
      writeAllNulls(bag);
      return;
    }

    try {
      const result = computeFargoGamesWonThresholds({
        homeRatings,
        awayRatings,
        totalGames,
      });
      bag.home_to_win = result.home.games_to_win;
      bag.home_to_tie = result.home.games_to_tie;
      bag.home_to_lose = result.home.games_to_lose;
      bag.away_to_win = result.away.games_to_win;
      bag.away_to_tie = result.away.games_to_tie;
      bag.away_to_lose = result.away.games_to_lose;
    } catch {
      writeAllNulls(bag);
    }
  },
};
