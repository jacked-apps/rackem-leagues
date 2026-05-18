/**
 * @fileoverview Tests for the income / green-fee / app-fee
 * calculators. Cover the brainstormed formula directly + the
 * "dropped team mid-season" subtraction logic that's the only
 * non-trivial behavior here.
 */

import { describe, it, expect } from 'vitest';
import {
  computeProjectedIncome,
  computeProjectedGreenFees,
  computeAppFee,
} from '../computeIncome';

describe('computeProjectedIncome', () => {
  it('returns the plain formula when no teams dropped', () => {
    // $10 × 5 × 8 × 12 = $4,800 (the worked example from the brainstorm)
    expect(
      computeProjectedIncome({
        pricePerPlayerPerNight: 10,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
      }),
    ).toBe(4800);
  });

  it('returns zero when any input is zero', () => {
    expect(
      computeProjectedIncome({
        pricePerPlayerPerNight: 0,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
      }),
    ).toBe(0);
    expect(
      computeProjectedIncome({
        pricePerPlayerPerNight: 10,
        lineupSize: 5,
        teamCount: 0,
        totalWeeks: 12,
      }),
    ).toBe(0);
  });

  it('subtracts a single dropped team correctly', () => {
    // 12-week season, team drops at week 6 → they paid weeks 1-5,
    // owe nothing for weeks 6-12 = 7 lost weeks.
    // Loss = $10 × 5 × 7 = $350. Income = 4800 - 350 = 4450.
    expect(
      computeProjectedIncome({
        pricePerPlayerPerNight: 10,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
        droppedTeams: [{ teamId: 't1', droppedAtWeek: 6 }],
      }),
    ).toBe(4450);
  });

  it('handles a team dropping at week 1 (paid nothing)', () => {
    // Dropped at week 1 → lost weeks = 12. Loss = $10 × 5 × 12 = $600.
    // Total base = 4800; minus 600 = 4200 (equivalent to 7 teams full).
    expect(
      computeProjectedIncome({
        pricePerPlayerPerNight: 10,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
        droppedTeams: [{ teamId: 't1', droppedAtWeek: 1 }],
      }),
    ).toBe(4200);
  });

  it('handles a team dropping at the LAST week (paid all but one)', () => {
    // Dropped at week 12 → 1 lost week. Loss = $10 × 5 × 1 = $50.
    expect(
      computeProjectedIncome({
        pricePerPlayerPerNight: 10,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
        droppedTeams: [{ teamId: 't1', droppedAtWeek: 12 }],
      }),
    ).toBe(4750);
  });

  it('handles multiple dropped teams independently', () => {
    // Two drops: week 4 (9 lost) + week 9 (4 lost) = 13 weeks lost.
    // Loss = $10 × 5 × 13 = $650. 4800 - 650 = 4150.
    expect(
      computeProjectedIncome({
        pricePerPlayerPerNight: 10,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
        droppedTeams: [
          { teamId: 't1', droppedAtWeek: 4 },
          { teamId: 't2', droppedAtWeek: 9 },
        ],
      }),
    ).toBe(4150);
  });

  it('treats a "dropped at week > total_weeks" entry as no-op', () => {
    // Defensive: bad data shouldn't go negative
    expect(
      computeProjectedIncome({
        pricePerPlayerPerNight: 10,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
        droppedTeams: [{ teamId: 't1', droppedAtWeek: 99 }],
      }),
    ).toBe(4800);
  });

  it('never returns negative income, even with absurd drop data', () => {
    // 10 dropped teams from an 8-team league at week 1 — would
    // mathematically be negative; we clamp to 0.
    expect(
      computeProjectedIncome({
        pricePerPlayerPerNight: 10,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
        droppedTeams: Array.from({ length: 10 }, (_, i) => ({
          teamId: `t${i}`,
          droppedAtWeek: 1,
        })),
      }),
    ).toBe(0);
  });
});

describe('computeProjectedGreenFees', () => {
  it('uses the same formula shape as income with the green-fee multiplier', () => {
    // $2 × 5 × 8 × 12 = $960 (brainstorm worked example)
    expect(
      computeProjectedGreenFees({
        greenFeePerPlayerPerNight: 2,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
      }),
    ).toBe(960);
  });

  it('subtracts dropped-team green fees the same way as income', () => {
    // Team drops at week 6 → 7 lost weeks. Loss = $2 × 5 × 7 = $70.
    // 960 - 70 = 890.
    expect(
      computeProjectedGreenFees({
        greenFeePerPlayerPerNight: 2,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
        droppedTeams: [{ teamId: 't1', droppedAtWeek: 6 }],
      }),
    ).toBe(890);
  });

  it('zero green fees produces zero', () => {
    expect(
      computeProjectedGreenFees({
        greenFeePerPlayerPerNight: 0,
        lineupSize: 5,
        teamCount: 8,
        totalWeeks: 12,
      }),
    ).toBe(0);
  });
});

describe('computeAppFee', () => {
  it('matches the published pricing on BecomeLeagueOperator.tsx', () => {
    // From the page: 8 teams × 16 weeks + $10 = $138
    expect(computeAppFee({ teamCount: 8, totalWeeks: 16 })).toBe(138);
    // 6 teams × 16 + 10 = $106
    expect(computeAppFee({ teamCount: 6, totalWeeks: 16 })).toBe(106);
    // 10 teams × 16 + 10 = $170
    expect(computeAppFee({ teamCount: 10, totalWeeks: 16 })).toBe(170);
  });

  it('handles a tiny season correctly', () => {
    // 1 team × 1 week + $10 = $11. Just the setup + minimum.
    expect(computeAppFee({ teamCount: 1, totalWeeks: 1 })).toBe(11);
  });

  it('always includes the $10 setup, even with zero teams', () => {
    expect(computeAppFee({ teamCount: 0, totalWeeks: 10 })).toBe(10);
    expect(computeAppFee({ teamCount: 10, totalWeeks: 0 })).toBe(10);
  });
});
