/**
 * @fileoverview Tests for the `linear_above_threshold` points calculator
 * (Phase 1 Unit 1.2).
 *
 * Locks the par formula: points = (games_won − par) × multiplier, where par
 * is the tie target when a tie is possible, else the win target. This is
 * Ed's league scoresheet formula (TABLE n!O19/P19); real matches from his
 * sheets are reproduced as test cases so the app can't drift from it again.
 *
 * Coverage:
 *   - Worked examples at the even chart row (W=10, T=9)
 *   - Real matches from Ed's scoresheets (week 14 table 1, prior season)
 *   - No-tie-possible variant (5v5-style: T = null)
 *   - Multiplier scaling
 *   - At-par invariant under varying multipliers (never moves off zero)
 *   - Defensive behavior on malformed params + null thresholds
 *   - Calculator metadata (name, kind, defaultParams, scoringPopupFields)
 *
 * The "tie-band-with-tiebreaker" integration test (won 9 of 18 + won
 * tiebreaker = 0 points; same team + lost tiebreaker = 0 points) lives in
 * Phase 5 Unit 5.5's tests — that's where the running-totals flow is built.
 * At THIS unit's level we only verify the formula; the calculator never
 * sees tiebreaker games (it's aggregate input — caller filters).
 */

import { describe, it, expect, vi } from 'vitest';
import { linearAboveThreshold } from '../linear_above_threshold';

// Helpers — make the test data read like the supplement's worked-examples table.
const ties_possible = (W: number, T: number) => ({
  games_to_win: W,
  games_to_tie: T,
  games_to_lose: T - 1,
});
const no_tie_possible = (W: number) => ({
  games_to_win: W,
  games_to_tie: null,
  games_to_lose: W - 1,
});
const compute = (
  gamesWon: number,
  thresholds: ReturnType<typeof ties_possible> | ReturnType<typeof no_tie_possible>,
  multiplier: number = 1,
) =>
  linearAboveThreshold.compute(
    { gamesWon, thresholds },
    { per_extra_game_multiplier: multiplier },
  );

describe('linear_above_threshold — calculator metadata', () => {
  it('has the expected name and kind', () => {
    expect(linearAboveThreshold.name).toBe('linear_above_threshold');
    expect(linearAboveThreshold.kind).toBe('aggregate');
  });

  it('has BCA 3v3 default params (multiplier=1)', () => {
    expect(linearAboveThreshold.defaultParams).toEqual({
      per_extra_game_multiplier: 1,
    });
  });

  it('declares scoringPopupFields with no per-side inputs (aggregate calculator)', () => {
    const spec = linearAboveThreshold.scoringPopupFields({
      per_extra_game_multiplier: 1,
    });
    expect(spec.perSideInputs).toBeNull();
  });

  it('paramSchema validates a good params object', () => {
    expect(
      linearAboveThreshold.paramSchema.safeParse({ per_extra_game_multiplier: 1 })
        .success,
    ).toBe(true);
  });

  it('paramSchema rejects a non-numeric multiplier', () => {
    expect(
      linearAboveThreshold.paramSchema.safeParse({
        per_extra_game_multiplier: 'fast' as unknown as number,
      }).success,
    ).toBe(false);
  });

  it('paramSchema rejects NaN / Infinity', () => {
    expect(
      linearAboveThreshold.paramSchema.safeParse({ per_extra_game_multiplier: NaN })
        .success,
    ).toBe(false);
    expect(
      linearAboveThreshold.paramSchema.safeParse({
        per_extra_game_multiplier: Infinity,
      }).success,
    ).toBe(false);
  });
});

describe('linear_above_threshold — par formula (BCA 3v3 even row: W=10, T=9, multiplier=1)', () => {
  // Tie possible → par is the tie target (9).
  const t = ties_possible(10, 9);

  it('12 wins → +3 (measured from the tie target, not the win target)', () => {
    expect(compute(12, t)).toBe(3);
  });

  it('11 wins → +2', () => {
    expect(compute(11, t)).toBe(2);
  });

  it('exactly at games_to_win (10) → +1', () => {
    expect(compute(10, t)).toBe(1);
  });

  it('exactly at games_to_tie (9) → 0 (regardless of tiebreaker outcome)', () => {
    // The user-specified rule: "if I need 10 to win or 9 to tie, and the
    // regular games end 9-9, the match goes to a tiebreaker. If I win the
    // tiebreaker, I do NOT get -1 points — I get 0. If I lose the
    // tiebreaker, I still get 0."
    //
    // The calculator sees 9 (regular-only games_won — caller has already
    // excluded tiebreakers). It returns 0. End of story. The match's
    // winner_team_id is decided by the tiebreaker; the points stay 0.
    expect(compute(9, t)).toBe(0);
  });

  it('8 wins → -1', () => {
    expect(compute(8, t)).toBe(-1);
  });

  it('7 wins → -2', () => {
    expect(compute(7, t)).toBe(-2);
  });

  it('0 wins → -9', () => {
    expect(compute(0, t)).toBe(-9);
  });
});

describe("linear_above_threshold — real matches from Ed's scoresheets", () => {
  // Each case is a match exactly as Ed's spreadsheet scored it.
  it('tie possible (T=9 each): 10–8 → +1 / −1 (prior season, wk 2)', () => {
    expect(compute(10, ties_possible(10, 9))).toBe(1);
    expect(compute(8, ties_possible(10, 9))).toBe(-1);
  });

  it('tie possible (T=9 each): 12–6 → +3 / −3 (prior season, wk 1)', () => {
    expect(compute(12, ties_possible(10, 9))).toBe(3);
    expect(compute(6, ties_possible(10, 9))).toBe(-3);
  });

  it('no tie possible (W=8 vs W=11): 9–9 → +1 / −2 (week 14, table 1)', () => {
    expect(compute(9, no_tie_possible(8))).toBe(1);
    expect(compute(9, no_tie_possible(11))).toBe(-2);
  });

  it('no tie possible (W=12 vs W=7): 13–5 → +1 / −2 (prior season, wk 1)', () => {
    expect(compute(13, no_tie_possible(12))).toBe(1);
    expect(compute(5, no_tie_possible(7))).toBe(-2);
  });
});

describe('linear_above_threshold — no-tie-possible (5v5-style)', () => {
  // BCA 5v5 SRR has 25 games (odd) — no tie possible. Threshold has T=null.
  const t = no_tie_possible(13);

  it('above-win band: 14 wins → +1', () => {
    expect(compute(14, t)).toBe(1);
  });

  it('exactly at win threshold: 13 wins → 0', () => {
    expect(compute(13, t)).toBe(0);
  });

  it('below win threshold: 12 wins → -1', () => {
    expect(compute(12, t)).toBe(-1);
  });

  it('below win threshold: 0 wins → -13', () => {
    expect(compute(0, t)).toBe(-13);
  });
});

describe('linear_above_threshold — multiplier scaling', () => {
  const t = ties_possible(10, 9);

  it('multiplier=2: 12 wins (par 9) → +6', () => {
    expect(compute(12, t, 2)).toBe(6);
  });

  it('multiplier=2: 8 wins (par 9) → -2', () => {
    expect(compute(8, t, 2)).toBe(-2);
  });

  it('multiplier=0.5: 14 wins (par 9) → +2.5', () => {
    expect(compute(14, t, 0.5)).toBe(2.5);
  });

  it('multiplier=0.5: 6 wins (par 9) → -1.5', () => {
    expect(compute(6, t, 0.5)).toBe(-1.5);
  });
});

describe('linear_above_threshold — at-par invariant', () => {
  // Multiplier scales the line but NEVER moves par off zero. These tests
  // fail loudly if a future refactor accidentally violates it.
  const t = ties_possible(10, 9);

  it('multiplier=1: at par (T=9) → 0', () => {
    expect(compute(9, t, 1)).toBe(0);
  });
  it('multiplier=2: at par (T=9) → still 0', () => {
    expect(compute(9, t, 2)).toBe(0);
  });
  it('multiplier=0.5: at par (T=9) → still 0', () => {
    expect(compute(9, t, 0.5)).toBe(0);
  });
  it('multiplier=100: at par (T=9) → still 0', () => {
    expect(compute(9, t, 100)).toBe(0);
  });
  it('multiplier=-1: at par (T=9) → still 0 (multiplier sign-change does not move it)', () => {
    expect(compute(9, t, -1)).toBe(0);
  });
  it('no tie possible: at par (W=13) → 0 under any multiplier', () => {
    expect(compute(13, no_tie_possible(13), 1)).toBe(0);
    expect(compute(13, no_tie_possible(13), 2)).toBe(0);
  });

  it('multiplier=0 collapses everything to 0', () => {
    expect(compute(15, t, 0)).toBe(0);
    expect(compute(10, t, 0)).toBe(0);
    expect(compute(9, t, 0)).toBe(0);
    expect(compute(5, t, 0)).toBe(0);
    expect(compute(0, t, 0)).toBe(0);
  });
});

describe('linear_above_threshold — defensive behavior', () => {
  it('returns 0 when thresholds.games_to_win is null (caller bug guard)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = linearAboveThreshold.compute(
      {
        gamesWon: 10,
        thresholds: {
          games_to_win: null as unknown as number,
          games_to_tie: 9,
          games_to_lose: 8,
        },
      },
      { per_extra_game_multiplier: 1 },
    );
    expect(result).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back to multiplier=1 when params fail zod validation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = linearAboveThreshold.compute(
      {
        gamesWon: 12,
        thresholds: ties_possible(10, 9),
      },
      { per_extra_game_multiplier: NaN as unknown as number }, // zod rejects NaN
    );
    // multiplier=1 fallback: (12 - par 9) * 1 = 3
    expect(result).toBe(3);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('handles params with extra unknown fields gracefully (zod ignores them)', () => {
    const result = linearAboveThreshold.compute(
      { gamesWon: 12, thresholds: ties_possible(10, 9) },
      { per_extra_game_multiplier: 1, unknownField: 'ignored' } as unknown as {
        per_extra_game_multiplier: number;
      },
    );
    expect(result).toBe(3);
  });
});

describe('linear_above_threshold — characterization equivalence with legacy calculatePoints', () => {
  // Confirms the calculator produces identical numbers to the existing
  // src/types/match.ts:calculatePoints function for the test space the
  // existing characterization suite exercises. This is a sanity check that
  // the lift-into-calculator step is behavior-preserving — important for
  // the deprecation-shim work landing alongside this unit.
  const cases: Array<{
    label: string;
    gamesWon: number;
    thresholds: { games_to_win: number; games_to_tie: number | null; games_to_lose: number | null };
    expected: number;
  }> = [
    // BCA 3v3 typical entries (W=10, T=9; the chart's diff=0 row)
    { label: '3v3 W=10 T=9: 12 wins', gamesWon: 12, thresholds: ties_possible(10, 9), expected: 3 },
    { label: '3v3 W=10 T=9: 10 wins', gamesWon: 10, thresholds: ties_possible(10, 9), expected: 1 },
    { label: '3v3 W=10 T=9:  9 wins', gamesWon: 9, thresholds: ties_possible(10, 9), expected: 0 },
    { label: '3v3 W=10 T=9:  8 wins', gamesWon: 8, thresholds: ties_possible(10, 9), expected: -1 },
    // Asymmetric thresholds (e.g., handicap-diff = 4 → home needs 12, T=11)
    { label: '3v3 W=12 T=11: 13 wins', gamesWon: 13, thresholds: ties_possible(12, 11), expected: 2 },
    { label: '3v3 W=12 T=11: 12 wins', gamesWon: 12, thresholds: ties_possible(12, 11), expected: 1 },
    { label: '3v3 W=12 T=11: 11 wins', gamesWon: 11, thresholds: ties_possible(12, 11), expected: 0 },
    { label: '3v3 W=12 T=11: 10 wins', gamesWon: 10, thresholds: ties_possible(12, 11), expected: -1 },
    // 5v5 odd total — no ties possible
    { label: '5v5 W=13: 14 wins', gamesWon: 14, thresholds: no_tie_possible(13), expected: 1 },
    { label: '5v5 W=13: 13 wins', gamesWon: 13, thresholds: no_tie_possible(13), expected: 0 },
    { label: '5v5 W=13: 12 wins', gamesWon: 12, thresholds: no_tie_possible(13), expected: -1 },
  ];

  for (const c of cases) {
    it(`${c.label} → ${c.expected}`, () => {
      expect(compute(c.gamesWon, c.thresholds, 1)).toBe(c.expected);
    });
  }
});
