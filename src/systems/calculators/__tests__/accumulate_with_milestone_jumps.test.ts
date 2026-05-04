/**
 * @fileoverview Tests for the `accumulate_with_milestone_jumps` calculator
 * (Phase 1 Unit 1.3).
 *
 * Locks the formula's monotonicity (no tie-band rule, unlike
 * linear_above_threshold) and characterization equivalence with the legacy
 * `calculateBCAPoints` function.
 *
 * Coverage:
 *   - Worked-example rows from the supplement (BCA 5v5 default: W=13, milestone=9)
 *   - Custom params (different milestone percent, different jump values)
 *   - Edge cases (very small W, per_game_increment=0)
 *   - Monotonicity invariant (points(N+1) >= points(N) for any params)
 *   - Defensive behavior on null thresholds + malformed params
 *   - Calculator metadata
 */

import { describe, it, expect, vi } from 'vitest';
import { accumulateWithMilestoneJumps } from '../accumulate_with_milestone_jumps';
import type { MilestoneJumpsParams } from '../accumulate_with_milestone_jumps';

const thresholds = (W: number) => ({
  games_to_win: W,
  games_to_tie: null,
  games_to_lose: null,
});

const compute = (
  gamesWon: number,
  W: number,
  params: MilestoneJumpsParams = accumulateWithMilestoneJumps.defaultParams,
) =>
  accumulateWithMilestoneJumps.compute(
    { gamesWon, thresholds: thresholds(W) },
    params,
  );

describe('accumulate_with_milestone_jumps — calculator metadata', () => {
  it('has the expected name and kind', () => {
    expect(accumulateWithMilestoneJumps.name).toBe('accumulate_with_milestone_jumps');
    expect(accumulateWithMilestoneJumps.kind).toBe('aggregate');
  });

  it('has BCA 5v5 default params', () => {
    expect(accumulateWithMilestoneJumps.defaultParams).toEqual({
      per_game_increment: 0.1,
      milestone_percent: 0.7,
      milestone_jump_value: 1.5,
      win_threshold_jump_value: 3.0,
    });
  });

  it('declares scoringPopupFields with no per-side inputs (aggregate calculator)', () => {
    const spec = accumulateWithMilestoneJumps.scoringPopupFields(
      accumulateWithMilestoneJumps.defaultParams,
    );
    expect(spec.perSideInputs).toBeNull();
  });

  it('paramSchema validates good params', () => {
    expect(
      accumulateWithMilestoneJumps.paramSchema.safeParse(
        accumulateWithMilestoneJumps.defaultParams,
      ).success,
    ).toBe(true);
  });

  it('paramSchema rejects missing fields', () => {
    expect(
      accumulateWithMilestoneJumps.paramSchema.safeParse({
        per_game_increment: 0.1,
      }).success,
    ).toBe(false);
  });

  it('paramSchema rejects non-finite values', () => {
    expect(
      accumulateWithMilestoneJumps.paramSchema.safeParse({
        ...accumulateWithMilestoneJumps.defaultParams,
        per_game_increment: NaN,
      }).success,
    ).toBe(false);
  });
});

describe('accumulate_with_milestone_jumps — formula (BCA 5v5 default: W=13, milestone=9)', () => {
  // Reproduces the supplement's worked-examples table exactly.
  // milestone_target = round(13 * 0.7) = round(9.1) = 9
  it('above-win band: 14 wins → 3.1 (jump 3.0 + 1 * 0.1)', () => {
    expect(compute(14, 13)).toBeCloseTo(3.1, 5);
  });

  it('exactly at win threshold: 13 wins → 3.0 (jump only)', () => {
    expect(compute(13, 13)).toBeCloseTo(3.0, 5);
  });

  it('between milestone and win: 12 wins → 1.8 (jump 1.5 + 3 * 0.1)', () => {
    expect(compute(12, 13)).toBeCloseTo(1.8, 5);
  });

  it('between milestone and win: 10 wins → 1.6 (jump 1.5 + 1 * 0.1)', () => {
    expect(compute(10, 13)).toBeCloseTo(1.6, 5);
  });

  it('exactly at milestone: 9 wins → 1.5 (jump only)', () => {
    expect(compute(9, 13)).toBeCloseTo(1.5, 5);
  });

  it('below milestone: 8 wins → 0.8 (8 * 0.1)', () => {
    expect(compute(8, 13)).toBeCloseTo(0.8, 5);
  });

  it('below milestone: 0 wins → 0', () => {
    expect(compute(0, 13)).toBeCloseTo(0, 5);
  });
});

describe('accumulate_with_milestone_jumps — milestone target rounding (Math.round, not ceil)', () => {
  // round(13 * 0.7) = round(9.1) = 9
  it('W=13 produces milestone target 9 (round of 9.1)', () => {
    // Verify by checking that 9 wins is at the milestone (jump value)
    expect(compute(9, 13)).toBeCloseTo(1.5, 5);
    // And 8 is below milestone (linear from zero)
    expect(compute(8, 13)).toBeCloseTo(0.8, 5);
  });

  // round(10 * 0.7) = round(7) = 7
  it('W=10 produces milestone target 7 (exact 7.0)', () => {
    expect(compute(7, 10)).toBeCloseTo(1.5, 5);
    expect(compute(6, 10)).toBeCloseTo(0.6, 5);
  });

  // round(15 * 0.7) = round(10.5) = 10 (banker's rounding rounds .5 to even
  // — Math.round in JS rounds .5 up, so 10.5 → 11)
  // BUT the supplement note says "straight round, not round up" — meaning
  // Math.round in JS, which DOES round .5 up. Confirm.
  it('W=15 produces milestone target 11 (Math.round of 10.5 = 11)', () => {
    // 11 wins → milestone band: 1.5 + 0 * 0.1 = 1.5
    expect(compute(11, 15)).toBeCloseTo(1.5, 5);
    // 10 wins → below milestone: 10 * 0.1 = 1.0
    expect(compute(10, 15)).toBeCloseTo(1.0, 5);
  });
});

describe('accumulate_with_milestone_jumps — custom params', () => {
  // LO who wants different jump values or a different milestone position.
  const customParams: MilestoneJumpsParams = {
    per_game_increment: 0.2, // double the linear contribution
    milestone_percent: 0.5, // milestone at half-threshold
    milestone_jump_value: 2.0,
    win_threshold_jump_value: 5.0,
  };

  it('custom milestone_percent=0.5: W=10 produces milestone target 5', () => {
    // milestone_target = round(10 * 0.5) = 5
    // 5 wins → milestone band: 2.0 + 0 * 0.2 = 2.0
    expect(compute(5, 10, customParams)).toBeCloseTo(2.0, 5);
    // 4 wins → below: 4 * 0.2 = 0.8
    expect(compute(4, 10, customParams)).toBeCloseTo(0.8, 5);
  });

  it('custom params: above win threshold scales by per_game_increment', () => {
    // 12 wins, W=10: win-threshold band — 5.0 + 2 * 0.2 = 5.4
    expect(compute(12, 10, customParams)).toBeCloseTo(5.4, 5);
  });

  it('custom params: between milestone and win', () => {
    // 8 wins, W=10, milestone=5: milestone band — 2.0 + 3 * 0.2 = 2.6
    expect(compute(8, 10, customParams)).toBeCloseTo(2.6, 5);
  });
});

describe('accumulate_with_milestone_jumps — monotonicity invariant', () => {
  // For any reasonable params, points should be non-decreasing as games_won
  // increases. This is the load-bearing property that distinguishes this
  // calculator from linear_above_threshold (which has a tie band).
  const params = accumulateWithMilestoneJumps.defaultParams;

  it('points are monotonically non-decreasing across the full range (W=13)', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 25; i++) {
      const points = compute(i, 13, params);
      expect(points).toBeGreaterThanOrEqual(prev);
      prev = points;
    }
  });

  it('monotonic with custom params too', () => {
    const customParams: MilestoneJumpsParams = {
      per_game_increment: 0.5,
      milestone_percent: 0.4,
      milestone_jump_value: 3.0,
      win_threshold_jump_value: 7.0,
    };
    let prev = -Infinity;
    for (let i = 0; i <= 25; i++) {
      const points = compute(i, 13, customParams);
      expect(points).toBeGreaterThanOrEqual(prev);
      prev = points;
    }
  });
});

describe('accumulate_with_milestone_jumps — edge cases', () => {
  it('per_game_increment=0: produces a pure step function with no linear contribution', () => {
    const params: MilestoneJumpsParams = {
      per_game_increment: 0,
      milestone_percent: 0.7,
      milestone_jump_value: 1.5,
      win_threshold_jump_value: 3.0,
    };
    // milestone_target = round(13 * 0.7) = 9
    expect(compute(0, 13, params)).toBe(0); // below milestone, 0 * 0 = 0
    expect(compute(8, 13, params)).toBe(0); // below milestone, 8 * 0 = 0
    expect(compute(9, 13, params)).toBe(1.5); // at milestone
    expect(compute(12, 13, params)).toBe(1.5); // milestone band, 1.5 + 3*0 = 1.5
    expect(compute(13, 13, params)).toBe(3.0); // at win threshold
    expect(compute(20, 13, params)).toBe(3.0); // above, 3.0 + 7*0 = 3.0
  });

  it('W=1: milestone target rounds to 1 (round(0.7) = 1); all win-states hit win-threshold', () => {
    // milestone_target = round(1 * 0.7) = round(0.7) = 1
    expect(compute(0, 1)).toBeCloseTo(0, 5); // below milestone (0 < 1)
    // At W=1: 1 wins is BOTH the milestone target AND the win threshold.
    // The win-threshold check fires first (gamesWon >= games_to_win is true).
    expect(compute(1, 1)).toBeCloseTo(3.0, 5); // win-threshold band, jump only
    expect(compute(2, 1)).toBeCloseTo(3.1, 5); // 1 over win = 3.0 + 0.1
  });

  it('W=0 (degenerate): milestone target = 0; everything is at win threshold', () => {
    // Edge case — combo-coherence shouldn't allow W=0 in practice, but
    // verify the formula doesn't crash.
    expect(compute(0, 0)).toBeCloseTo(3.0, 5);
    expect(compute(5, 0)).toBeCloseTo(3.5, 5);
  });
});

describe('accumulate_with_milestone_jumps — defensive behavior', () => {
  it('returns 0 when thresholds.games_to_win is null', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = accumulateWithMilestoneJumps.compute(
      {
        gamesWon: 10,
        thresholds: {
          games_to_win: null as unknown as number,
          games_to_tie: null,
          games_to_lose: null,
        },
      },
      accumulateWithMilestoneJumps.defaultParams,
    );
    expect(result).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back to default params when params fail zod validation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = accumulateWithMilestoneJumps.compute(
      { gamesWon: 13, thresholds: thresholds(13) },
      // Missing fields — schema rejects, fallback uses defaults
      { per_game_increment: 0.1 } as unknown as MilestoneJumpsParams,
    );
    // BCA 5v5 defaults at W=13, gamesWon=13: jump value = 3.0
    expect(result).toBeCloseTo(3.0, 5);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('accumulate_with_milestone_jumps — characterization equivalence with legacy calculateBCAPoints', () => {
  // The supplement and the legacy function's example comment both list
  // these as the canonical BCA 5v5 cases. Verifying the new calculator
  // produces identical numbers proves the lift is behavior-preserving.
  const cases: Array<{ label: string; gamesWon: number; W: number; expected: number }> = [
    { label: 'BCA 5v5 W=13: 14 wins', gamesWon: 14, W: 13, expected: 3.1 },
    { label: 'BCA 5v5 W=13: 13 wins', gamesWon: 13, W: 13, expected: 3.0 },
    { label: 'BCA 5v5 W=13: 12 wins', gamesWon: 12, W: 13, expected: 1.8 },
    { label: 'BCA 5v5 W=13: 10 wins', gamesWon: 10, W: 13, expected: 1.6 },
    { label: 'BCA 5v5 W=13:  9 wins', gamesWon: 9, W: 13, expected: 1.5 },
    { label: 'BCA 5v5 W=13:  8 wins', gamesWon: 8, W: 13, expected: 0.8 },
    { label: 'BCA 5v5 W=13:  1 win',  gamesWon: 1, W: 13, expected: 0.1 },
    { label: 'BCA 5v5 W=13:  0 wins', gamesWon: 0, W: 13, expected: 0 },
  ];

  for (const c of cases) {
    it(`${c.label} → ${c.expected}`, () => {
      expect(compute(c.gamesWon, c.W)).toBeCloseTo(c.expected, 5);
    });
  }
});
