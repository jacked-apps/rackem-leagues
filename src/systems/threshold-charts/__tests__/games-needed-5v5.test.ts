/**
 * @fileoverview Tests for the 5v5 Games-Needed Chart variant.
 *
 * Module-level wrapper test. The full 7-range chart characterization is
 * locked in `src/utils/handicap/__tests__/getGamesNeeded.characterization.test.ts`;
 * these tests verify the Chart Module faithfully delegates to it.
 *
 * @see ../games-needed-5v5.ts — the variant under test
 */

import { describe, it, expect } from 'vitest';
import { gamesNeeded5v5Chart } from '../games-needed-5v5';
import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';

describe('gamesNeeded5v5Chart — 5v5 Percentage Games-Needed Chart', () => {
  describe('module identity', () => {
    it('kind is "games_needed_5v5"', () => {
      expect(gamesNeeded5v5Chart.kind).toBe('games_needed_5v5');
    });
  });

  describe('compute — 7-range bucket values', () => {
    // Per the BCA_5V5_RANGES table: each range has (higherTeamWins, lowerTeamWins).
    // 25-game match (single round-robin); games_to_tie is always null.
    it.each([
      [0, { games_to_win: 13, games_to_tie: null, games_to_lose: 12 }], // range 0-14
      [16, { games_to_win: 14, games_to_tie: null, games_to_lose: 13 }], // range 15-40
      [50, { games_to_win: 15, games_to_tie: null, games_to_lose: 14 }], // range 41-66
      [80, { games_to_win: 16, games_to_tie: null, games_to_lose: 15 }], // range 67-92
      [100, { games_to_win: 17, games_to_tie: null, games_to_lose: 16 }], // range 93-118
      [130, { games_to_win: 18, games_to_tie: null, games_to_lose: 17 }], // range 119-144
      [200, { games_to_win: 19, games_to_tie: null, games_to_lose: 18 }], // range 145+
    ])('diff %i returns %o', (diff, expected) => {
      expect(gamesNeeded5v5Chart.compute(diff)).toEqual(expected);
    });
  });

  describe('compute — asymmetric routing by sign', () => {
    it('positive diff routes to higher-team values; negative routes to lower-team values', () => {
      // For range 15-40: higherTeamWins=14, lowerTeamWins=12
      const positive = gamesNeeded5v5Chart.compute(20);
      const negative = gamesNeeded5v5Chart.compute(-20);
      expect(positive.games_to_win).toBe(14);
      expect(negative.games_to_win).toBe(12);
    });
  });

  describe('compute — games_to_tie is always null (25 games is odd)', () => {
    it.each([0, 14, 15, 40, 66, 92, 118, 144, 145, 500, -14, -40, -145])(
      'diff %i: games_to_tie is null',
      (diff) => {
        expect(gamesNeeded5v5Chart.compute(diff).games_to_tie).toBeNull();
      },
    );
  });

  describe('delegate fidelity — Module output equals utility output', () => {
    it.each([0, 14, 15, 40, 66, 92, 118, 144, 145, 500, -14, -15, -40, -145])(
      'diff %i: Module output equals get5v5GamesNeeded output',
      (diff) => {
        expect(gamesNeeded5v5Chart.compute(diff)).toEqual(get5v5GamesNeeded(diff));
      },
    );
  });
});
