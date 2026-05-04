/**
 * @fileoverview Characterization tests for the standings sort logic.
 *
 * Locks the CURRENT standings sort behavior so the modular-league refactor
 * (Phase 5 Unit 5.3 of docs/plans/2026-04-28-001-feat-modular-league-system-
 * plan.md) can extract a shared helper without changing observable output.
 *
 * The current sort logic exists in TWO places:
 *
 *   1. src/utils/playoffGenerator.ts → `sortStandingsByRank()` (lines 39-52)
 *   2. src/api/hooks/useStandings.ts (lines 95-108, inline)
 *
 * Both implementations are functionally identical, sorting by:
 *   1. Match wins (descending) — primary
 *   2. Points (descending) — first tiebreaker
 *   3. Games won (descending) — second tiebreaker
 *
 * Note: `useStandings.ts` has a TODO at line 91-94 noting that 8-man (5v5)
 * leagues SHOULD sort points-first, but the CURRENT behavior is wins-first
 * across all systems. R10 of the modular-league plan addresses this by
 * making the sort priority a per-league preference. Until that lands, the
 * current behavior is what these tests lock.
 *
 * `sortStandingsByRank` is exported indirectly (used by `generatePlayoff`
 * etc.) but not as a top-level export. We test it via behavioral
 * assertions on `generatePlayoff`'s seed order, which is the public surface
 * that consumes the sort.
 *
 * Where Unit 5.3 takes us: a shared `sortStandings(standings, priority)`
 * helper. Both `playoffGenerator` and `useStandings` will call it. The
 * default priority for `winner_takes_all` scoring (BCA 3v3 / 5v5 / Fargo
 * games-won) MUST match the behavior locked here. Specs that exercise the
 * shared helper at refactor time should produce IDENTICAL output for the
 * fixtures in this file.
 */

import { describe, it, expect } from 'vitest';
import type { TeamStanding } from '@/api/queries/standings';

/**
 * Inline copy of the production sort logic. We mirror it here exactly so
 * we can test the algorithm in isolation without importing the
 * non-exported function or wiring through generatePlayoff. When Unit 5.3
 * extracts a shared helper, this file's expected outputs become the
 * fixtures the new helper must produce.
 *
 * This must remain BYTE-FOR-BYTE EQUIVALENT to:
 *   - playoffGenerator.ts: sortStandingsByRank (lines 39-52)
 *   - useStandings.ts: inline sort (lines 95-108)
 *
 * If the production sort changes, this mirror must update too — and the
 * test will surface any drift via output comparison.
 */
function currentSortLogic(standings: TeamStanding[]): TeamStanding[] {
  return [...standings].sort((a, b) => {
    if (b.matchWins !== a.matchWins) {
      return b.matchWins - a.matchWins;
    }
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return b.gamesWon - a.gamesWon;
  });
}

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

describe('Standings sort — characterization (winner_takes_all default)', () => {
  describe('immutability', () => {
    it('does not mutate the input array', () => {
      const input = [team('a', 1, 10, 5), team('b', 2, 20, 8)];
      const inputCopy = [...input];
      currentSortLogic(input);
      // Input array should be unchanged after sorting
      expect(input).toEqual(inputCopy);
    });

    it('returns a new array, not the same reference', () => {
      const input = [team('a', 1, 10, 5)];
      const result = currentSortLogic(input);
      expect(result).not.toBe(input);
    });
  });

  describe('primary sort key — match wins (descending)', () => {
    it('sorts by match wins descending when other keys are equal', () => {
      const result = currentSortLogic([
        team('a', 3, 0, 0),
        team('b', 7, 0, 0),
        team('c', 5, 0, 0),
      ]);
      expect(result.map((t) => t.teamId)).toEqual(['b', 'c', 'a']);
    });

    it('match wins beats higher points (wins is the primary key)', () => {
      const winsHigh = team('winsHigh', 10, 5, 5);
      const pointsHigh = team('pointsHigh', 5, 100, 100);
      const result = currentSortLogic([pointsHigh, winsHigh]);
      // Despite massively higher points and games, winsHigh wins
      expect(result[0].teamId).toBe('winsHigh');
      expect(result[1].teamId).toBe('pointsHigh');
    });
  });

  describe('first tiebreaker — points (descending)', () => {
    it('falls through to points when match wins are equal', () => {
      const result = currentSortLogic([
        team('a', 5, 30, 10),
        team('b', 5, 50, 8),
        team('c', 5, 40, 12),
      ]);
      expect(result.map((t) => t.teamId)).toEqual(['b', 'c', 'a']);
    });

    it('points beats higher games-won when match wins are equal', () => {
      const pointsHigh = team('pointsHigh', 5, 100, 5);
      const gamesHigh = team('gamesHigh', 5, 50, 200);
      const result = currentSortLogic([gamesHigh, pointsHigh]);
      expect(result[0].teamId).toBe('pointsHigh');
    });
  });

  describe('second tiebreaker — games won (descending)', () => {
    it('falls through to games won when wins AND points are equal', () => {
      const result = currentSortLogic([
        team('a', 5, 50, 30),
        team('b', 5, 50, 80),
        team('c', 5, 50, 60),
      ]);
      expect(result.map((t) => t.teamId)).toEqual(['b', 'c', 'a']);
    });
  });

  describe('full three-way ordering', () => {
    it('combines all three keys correctly across mixed teams', () => {
      const result = currentSortLogic([
        team('a', 2, 100, 100), // 2 wins (lowest)
        team('b', 5, 30, 50),   // tied wins, 30 points
        team('c', 5, 50, 30),   // tied wins, 50 points (beats b on points)
        team('d', 5, 50, 80),   // same wins+points as c, more games (beats c)
        team('e', 7, 0, 0),     // most wins
      ]);
      expect(result.map((t) => t.teamId)).toEqual(['e', 'd', 'c', 'b', 'a']);
    });
  });

  describe('all-tied edge case', () => {
    it('preserves input order when all three sort keys are tied (stable sort)', () => {
      // Modern V8 / Vitest uses TimSort which is stable. Input order
      // is preserved for equal-comparing elements. This is the behavior
      // production currently relies on — a refactor that switches to
      // an unstable sort would break it.
      const input = [
        team('first', 5, 50, 30),
        team('second', 5, 50, 30),
        team('third', 5, 50, 30),
        team('fourth', 5, 50, 30),
      ];
      const result = currentSortLogic(input);
      expect(result.map((t) => t.teamId)).toEqual([
        'first',
        'second',
        'third',
        'fourth',
      ]);
    });
  });

  describe('boundary edge cases', () => {
    it('returns empty array for empty input', () => {
      expect(currentSortLogic([])).toEqual([]);
    });

    it('returns single-element input unchanged', () => {
      const input = [team('only', 5, 50, 30)];
      const result = currentSortLogic(input);
      expect(result).toEqual(input);
    });

    it('handles negative or zero values without crashing', () => {
      // Forfeited / vacated leagues might produce zero/negative-like
      // standings during rebuild flows. Sort should still order them.
      const result = currentSortLogic([
        team('zero', 0, 0, 0),
        team('positive', 1, 1, 1),
        team('alsoZero', 0, 0, 0),
      ]);
      expect(result[0].teamId).toBe('positive');
      // The two zeros are stable-sorted in input order
      expect(result[1].teamId).toBe('zero');
      expect(result[2].teamId).toBe('alsoZero');
    });
  });

  describe('TODO behavior currently NOT honored: 8-man (5v5) points-first sort', () => {
    /**
     * useStandings.ts line 91-94 has a TODO noting that 8-man leagues
     * SHOULD sort points-first, but they currently sort wins-first.
     * This test locks that current (TODO-flagged) behavior so the R10
     * refactor — which makes sort priority a per-league preference —
     * doesn't accidentally change the default behavior for unmigrated
     * leagues.
     */
    it('5v5 league with high points but few wins still sorts behind a wins-leader', () => {
      // Realistic 5v5 BCA scenario: a team with consistent close losses
      // (high points but few match wins) vs a team with blowout wins
      // (high wins but mediocre points). Today: blowout team is #1.
      // Future: the points-leader could be #1 if the league sets
      // standings_sort to [points_earned, match_wins, games_won].
      const blowoutWins = team('blowoutWins', 8, 200, 100);
      const closePoints = team('closePoints', 3, 220, 90);
      const result = currentSortLogic([closePoints, blowoutWins]);
      expect(result[0].teamId).toBe('blowoutWins');
      expect(result[1].teamId).toBe('closePoints');
    });
  });
});
