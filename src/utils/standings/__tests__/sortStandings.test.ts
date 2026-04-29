/**
 * @fileoverview Unit tests for the shared sortStandings helper.
 *
 * Companion to the characterization tests at
 * src/utils/__tests__/playoffGenerator.standingsSort.characterization.test.ts
 * which lock the LEGACY behavior. This file tests the new helper directly
 * (including the configurable-priority feature R10 will use).
 *
 * The default priority of `sortStandings()` matches what the legacy
 * inline sorts did — so the characterization tests in the playoffGenerator
 * companion file all pass against this helper too.
 */

import { describe, it, expect } from 'vitest';
import {
  sortStandings,
  DEFAULT_STANDINGS_SORT_PRIORITY,
  type StandingsSortKey,
} from '../sortStandings';
import type { TeamStanding } from '@/api/queries/standings';

function team(
  teamId: string,
  matchWins: number,
  points: number,
  gamesWon: number,
  matchLosses = 0
): TeamStanding {
  return {
    teamId,
    teamName: `Team ${teamId}`,
    matchWins,
    matchLosses,
    points,
    gamesWon,
  };
}

describe('sortStandings', () => {
  describe('default priority [match_wins, games_won, points_earned]', () => {
    it('sorts by match_wins first', () => {
      const result = sortStandings([
        team('a', 3, 100, 50),
        team('b', 5, 50, 30),
        team('c', 4, 75, 40),
      ]);
      expect(result.map((t) => t.teamId)).toEqual(['b', 'c', 'a']);
    });

    it('falls through to games_won when match_wins ties', () => {
      const result = sortStandings([
        team('a', 5, 100, 30),
        team('b', 5, 50, 50),
        team('c', 5, 75, 40),
      ]);
      expect(result.map((t) => t.teamId)).toEqual(['b', 'c', 'a']);
    });

    it('falls through to points_earned when match_wins AND games_won tie', () => {
      const result = sortStandings([
        team('a', 5, 30, 50),
        team('b', 5, 100, 50),
        team('c', 5, 50, 50),
      ]);
      expect(result.map((t) => t.teamId)).toEqual(['b', 'c', 'a']);
    });
  });

  describe('configurable priority (R10 of modular plan)', () => {
    it('points-first: a 5v5-style league where BCA points are primary', () => {
      // The TODO at useStandings.ts line 91 noted 8-man leagues should
      // sort points-first. R10 makes this a per-league preference.
      const result = sortStandings(
        [
          team('a', 5, 30, 50), // 5 wins, 30 points, 50 games
          team('b', 3, 100, 30), // 3 wins, 100 points, 30 games
          team('c', 4, 50, 40), // 4 wins, 50 points, 40 games
        ],
        ['points_earned', 'match_wins', 'games_won']
      );
      expect(result.map((t) => t.teamId)).toEqual(['b', 'c', 'a']);
    });

    it('games-only priority: rank purely by games won', () => {
      const result = sortStandings(
        [
          team('a', 1, 1, 100),
          team('b', 99, 99, 1),
        ],
        ['games_won']
      );
      expect(result[0].teamId).toBe('a');
    });

    it('different orderings produce different results for the same data', () => {
      const data = [team('a', 5, 30, 50), team('b', 3, 100, 50)];
      const winsFirst = sortStandings(data, ['match_wins', 'points_earned', 'games_won']);
      const pointsFirst = sortStandings(data, ['points_earned', 'match_wins', 'games_won']);
      expect(winsFirst[0].teamId).toBe('a');
      expect(pointsFirst[0].teamId).toBe('b');
    });
  });

  describe('empty / fallback priority', () => {
    it('empty priority array uses the default priority', () => {
      const data = [team('a', 3, 100, 30), team('b', 5, 30, 50)];
      const withEmpty = sortStandings(data, []);
      const withDefault = sortStandings(data);
      expect(withEmpty).toEqual(withDefault);
    });

    it('DEFAULT_STANDINGS_SORT_PRIORITY is explicitly [match_wins, games_won, points_earned]', () => {
      // Lock the default value so any change to the default is visible.
      expect(DEFAULT_STANDINGS_SORT_PRIORITY).toEqual([
        'match_wins',
        'games_won',
        'points_earned',
      ] satisfies StandingsSortKey[]);
    });
  });

  describe('immutability and stability', () => {
    it('does not mutate the input array', () => {
      const input = [team('a', 1, 10, 5), team('b', 2, 20, 8)];
      const inputCopy = [...input];
      sortStandings(input);
      expect(input).toEqual(inputCopy);
    });

    it('returns a new array, not the same reference', () => {
      const input = [team('a', 1, 10, 5)];
      const result = sortStandings(input);
      expect(result).not.toBe(input);
    });

    it('preserves input order when all priority keys are tied (stable sort)', () => {
      const input = [
        team('first', 5, 50, 30),
        team('second', 5, 50, 30),
        team('third', 5, 50, 30),
      ];
      const result = sortStandings(input);
      expect(result.map((t) => t.teamId)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('boundary cases', () => {
    it('returns empty array unchanged', () => {
      expect(sortStandings([])).toEqual([]);
    });

    it('returns single-element input unchanged', () => {
      const input = [team('only', 5, 50, 30)];
      expect(sortStandings(input)).toEqual(input);
    });

    it('handles negative or zero values without crashing', () => {
      const result = sortStandings([
        team('zero', 0, 0, 0),
        team('positive', 1, 1, 1),
      ]);
      expect(result[0].teamId).toBe('positive');
      expect(result[1].teamId).toBe('zero');
    });
  });
});
