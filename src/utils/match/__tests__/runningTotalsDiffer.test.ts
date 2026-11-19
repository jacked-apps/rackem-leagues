/**
 * @fileoverview runningTotalsDiffer — the alarm that tells devs the new points
 * engine and the legacy backup disagree on a live match. If it goes quiet, a
 * scoring bug in either path stops making noise (found by the mutation run,
 * U8: no test checked it directly).
 *
 * Rule: any difference in games won is a disagreement; points may differ only
 * by float rounding noise (under 0.000001).
 *
 * @see ../engineRunningTotals.ts
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U8)
 */

import { describe, it, expect } from 'vitest';
import { runningTotalsDiffer } from '../engineRunningTotals';

const TOTALS = { home_games_won: 11, away_games_won: 7, home_points_earned: 2, away_points_earned: -2 };

describe('runningTotalsDiffer', () => {
  it('identical totals → no alarm', () => {
    expect(runningTotalsDiffer(TOTALS, { ...TOTALS })).toBe(false);
  });

  it.each([
    ['home games won', { home_games_won: 12 }],
    ['away games won', { away_games_won: 6 }],
    ['home points', { home_points_earned: 3 }],
    ['away points', { away_points_earned: -1 }],
  ])('a different %s → alarm', (_label, change) => {
    expect(runningTotalsDiffer(TOTALS, { ...TOTALS, ...change })).toBe(true);
  });

  it('float rounding noise in points (7.4 vs 7.400000000000002) → no alarm', () => {
    const a = { ...TOTALS, home_points_earned: 7.4, away_points_earned: 7.4 };
    const b = { ...TOTALS, home_points_earned: 7.400000000000002, away_points_earned: 7.400000000000002 };
    expect(runningTotalsDiffer(a, b)).toBe(false);
  });
});
