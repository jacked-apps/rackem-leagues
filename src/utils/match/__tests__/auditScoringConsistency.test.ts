/**
 * @fileoverview Tests for compareRunningTotals — Phase 5 Unit 5.6.
 *
 * The pure comparison logic. The IO-wrapper integration tests
 * (auditMatchScoringConsistency in api/queries/matches.ts) live alongside
 * the other database-level integration tests.
 */

import { describe, it, expect } from 'vitest';
import { compareRunningTotals } from '../auditScoringConsistency';
import type { MatchRunningTotals } from '../computeMatchRunningTotals';

const matched = (overrides: Partial<MatchRunningTotals> = {}): MatchRunningTotals => ({
  home_games_won: 10,
  away_games_won: 8,
  home_points_earned: 1,
  away_points_earned: -1,
  ...overrides,
});

describe('compareRunningTotals', () => {
  it('returns ok when stored matches expected', () => {
    const result = compareRunningTotals(matched(), matched());
    expect(result.ok).toBe(true);
    expect(result.discrepancies).toEqual([]);
  });

  it('flags a divergence on home_games_won', () => {
    const stored = matched({ home_games_won: 11 });
    const expected = matched({ home_games_won: 10 });
    const result = compareRunningTotals(stored, expected);

    expect(result.ok).toBe(false);
    expect(result.discrepancies).toEqual([
      { field: 'home_games_won', expected: 10, actual: 11, diff: 1 },
    ]);
  });

  it('flags a divergence on home_points_earned', () => {
    const stored = matched({ home_points_earned: 0 });
    const expected = matched({ home_points_earned: 1 });
    const result = compareRunningTotals(stored, expected);

    expect(result.ok).toBe(false);
    expect(result.discrepancies).toEqual([
      { field: 'home_points_earned', expected: 1, actual: 0, diff: -1 },
    ]);
  });

  it('flags multiple simultaneous divergences', () => {
    const stored = matched({ home_games_won: 11, away_points_earned: 5 });
    const expected = matched({ home_games_won: 10, away_points_earned: -1 });
    const result = compareRunningTotals(stored, expected);

    expect(result.ok).toBe(false);
    expect(result.discrepancies).toHaveLength(2);
    expect(result.discrepancies).toContainEqual({
      field: 'home_games_won',
      expected: 10,
      actual: 11,
      diff: 1,
    });
    expect(result.discrepancies).toContainEqual({
      field: 'away_points_earned',
      expected: -1,
      actual: 5,
      diff: 6,
    });
  });

  it('reports the expected diff sign convention (positive = stored too high)', () => {
    const stored = matched({ home_games_won: 12 });
    const expected = matched({ home_games_won: 10 });
    const result = compareRunningTotals(stored, expected);

    const d = result.discrepancies.find((x) => x.field === 'home_games_won');
    expect(d).toBeDefined();
    expect(d!.diff).toBe(2);
  });

  it('reports a negative diff when stored is too low', () => {
    const stored = matched({ home_games_won: 8 });
    const expected = matched({ home_games_won: 10 });
    const result = compareRunningTotals(stored, expected);

    const d = result.discrepancies.find((x) => x.field === 'home_games_won');
    expect(d).toBeDefined();
    expect(d!.diff).toBe(-2);
  });

  it('does not mutate the inputs', () => {
    const stored = matched({ home_games_won: 11 });
    const expected = matched();
    const storedSnapshot = { ...stored };
    const expectedSnapshot = { ...expected };

    compareRunningTotals(stored, expected);

    expect(stored).toEqual(storedSnapshot);
    expect(expected).toEqual(expectedSnapshot);
  });
});
