/**
 * @fileoverview Tests for the 3v3 Games-Needed Chart variant.
 *
 * Module-level wrapper test. The full 25-row chart characterization is
 * locked in `src/utils/handicap/__tests__/getGamesNeeded.characterization.test.ts`;
 * these tests verify the Chart Module faithfully delegates to it.
 *
 * @see ../games-needed-3v3.ts — the variant under test
 */

import { describe, it, expect } from 'vitest';
import { gamesNeeded3v3Chart } from '../games-needed-3v3';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';

describe('gamesNeeded3v3Chart — 3v3 Points Games-Needed Chart', () => {
  describe('module identity', () => {
    it('kind is "games_needed_3v3"', () => {
      expect(gamesNeeded3v3Chart.kind).toBe('games_needed_3v3');
    });
  });

  describe('compute — exact-match values', () => {
    it.each([
      [0, { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 }],
      [2, { games_to_win: 11, games_to_tie: 10, games_to_lose: 9 }],
      [-2, { games_to_win: 9, games_to_tie: 8, games_to_lose: 7 }],
      [5, { games_to_win: 12, games_to_tie: null, games_to_lose: 11 }],
      [12, { games_to_win: 16, games_to_tie: 15, games_to_lose: 14 }],
      [-12, { games_to_win: 4, games_to_tie: 3, games_to_lose: 2 }],
    ])('diff %i returns %o', (diff, expected) => {
      expect(gamesNeeded3v3Chart.compute(diff)).toEqual(expected);
    });
  });

  describe('compute — out-of-range capping', () => {
    it('caps positive diffs above +12 to the +12 row', () => {
      expect(gamesNeeded3v3Chart.compute(20)).toEqual(
        gamesNeeded3v3Chart.compute(12),
      );
      expect(gamesNeeded3v3Chart.compute(100)).toEqual(
        gamesNeeded3v3Chart.compute(12),
      );
    });

    it('caps negative diffs below -12 to the -12 row', () => {
      expect(gamesNeeded3v3Chart.compute(-20)).toEqual(
        gamesNeeded3v3Chart.compute(-12),
      );
      expect(gamesNeeded3v3Chart.compute(-100)).toEqual(
        gamesNeeded3v3Chart.compute(-12),
      );
    });
  });

  describe('delegate fidelity — Module output equals utility output', () => {
    it.each([0, 1, -1, 5, -5, 12, -12, 20, -20])(
      'diff %i: Module output equals get3v3GamesNeeded output',
      (diff) => {
        expect(gamesNeeded3v3Chart.compute(diff)).toEqual(get3v3GamesNeeded(diff));
      },
    );
  });
});
