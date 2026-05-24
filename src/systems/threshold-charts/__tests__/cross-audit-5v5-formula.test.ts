/**
 * @fileoverview Cross-audit: 5v5 Games-Needed formula Module vs. existing chart.
 *
 * Same methodology as the 3v3 audit. Three implementations must agree row-for-row:
 *
 *   1. Old chart (legacy):   `get5v5GamesNeeded` TS range-lookup — source of truth.
 *   2. New chart (Module):   `gamesNeeded5v5Chart` from Phase A — wraps the TS lookup.
 *   3. New formula (Module): `gamesNeeded5v5FormulaChart` — locked-spec pseudocode
 *      implemented byte-exact, parameterized by game_count.
 *
 * At game_count=25 the formula must reproduce BCAPL's 7-bucket Standard
 * Handicap Chart row-for-row (boundaries 0, 15, 41, 67, 93, 119, 145 →
 * targets 13/13 through 19/7).
 *
 * @see ../games-needed-5v5-formula.ts — the Module under audit
 * @see ../games-needed-5v5.ts — the table-shape companion
 */

import { describe, it, expect } from 'vitest';
import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';
import { gamesNeeded5v5Chart } from '../games-needed-5v5';
import { gamesNeeded5v5FormulaChart } from '../games-needed-5v5-formula';

const GAME_COUNT_5V5 = 25;

// Every bucket boundary + interior samples + past-cap inputs.
const REPRESENTATIVE_POSITIVE_DIFFS = [
  0, 1, 7, 14, // bucket 0 (0–14)
  15, 20, 30, 40, // bucket 1 (15–40)
  41, 50, 60, 66, // bucket 2 (41–66)
  67, 80, 92, // bucket 3 (67–92)
  93, 100, 118, // bucket 4 (93–118)
  119, 130, 144, // bucket 5 (119–144)
  145, 200, 500, 999, // bucket 6 (145+, capped)
];

const REPRESENTATIVE_DIFFS = [
  ...REPRESENTATIVE_POSITIVE_DIFFS.map((d) => -d).filter((d) => d !== 0),
  ...REPRESENTATIVE_POSITIVE_DIFFS,
];

describe('Cross-audit: 5v5 Games-Needed — old chart / new chart Module / new formula Module', () => {
  describe('Step 1: old chart vs. new chart Module — byte-equivalence', () => {
    it.each(REPRESENTATIVE_DIFFS)(
      'diff %i: old chart === new chart Module',
      (diff) => {
        expect(gamesNeeded5v5Chart.compute(diff)).toEqual(get5v5GamesNeeded(diff));
      },
    );
  });

  describe('Step 2: new formula Module vs. old chart — formula reproduces the chart', () => {
    it.each(REPRESENTATIVE_DIFFS)(
      'diff %i: formula Module.compute === chart row-for-row',
      (diff) => {
        expect(gamesNeeded5v5FormulaChart.compute(diff)).toEqual(
          get5v5GamesNeeded(diff),
        );
      },
    );
  });

  describe("Step 3: Ed's sum-invariant rule (non-tie always → game_count + 1)", () => {
    // 25 games is odd; ties never possible — every row is non-tie.
    it.each(REPRESENTATIVE_POSITIVE_DIFFS)(
      'diff=+%i: stronger_win + weaker_win = game_count + 1 (26)',
      (diff) => {
        const stronger = gamesNeeded5v5FormulaChart.compute(diff);
        const weaker = gamesNeeded5v5FormulaChart.compute(-diff);
        expect(stronger.games_to_win + weaker.games_to_win).toBe(
          GAME_COUNT_5V5 + 1,
        );
      },
    );

    it.each(REPRESENTATIVE_POSITIVE_DIFFS)(
      'diff=+%i: games_to_tie is null (25 = odd; no ties)',
      (diff) => {
        expect(gamesNeeded5v5FormulaChart.compute(diff).games_to_tie).toBeNull();
        expect(get5v5GamesNeeded(diff).games_to_tie).toBeNull();
      },
    );
  });

  describe('Step 4: gap_cap behavior (formula clamps |diff| at the input)', () => {
    it('diff=200 produces the same output as diff=145 (capped)', () => {
      expect(gamesNeeded5v5FormulaChart.compute(200)).toEqual(
        gamesNeeded5v5FormulaChart.compute(145),
      );
    });

    it('diff=-999 produces the same output as diff=-145 (capped)', () => {
      expect(gamesNeeded5v5FormulaChart.compute(-999)).toEqual(
        gamesNeeded5v5FormulaChart.compute(-145),
      );
    });
  });

  describe('Step 5: bucket-boundary spot-checks against the locked spec', () => {
    // Per the locked 5v5-games-needed.md: at game_count=25, bucket boundaries
    // are (0, 15, 41, 67, 93, 119, 145) and bucket targets are
    // (13/13, 14/12, 15/11, 16/10, 17/9, 18/8, 19/7).
    const EXPECTED_BUCKETS: Array<{
      diff: number;
      stronger_win: number;
      stronger_lose: number;
    }> = [
      { diff: 0, stronger_win: 13, stronger_lose: 12 }, // weaker_win = 13 → lose = 25-13 = 12
      { diff: 15, stronger_win: 14, stronger_lose: 13 }, // weaker_win = 12 → lose = 25-12 = 13
      { diff: 41, stronger_win: 15, stronger_lose: 14 },
      { diff: 67, stronger_win: 16, stronger_lose: 15 },
      { diff: 93, stronger_win: 17, stronger_lose: 16 },
      { diff: 119, stronger_win: 18, stronger_lose: 17 },
      { diff: 145, stronger_win: 19, stronger_lose: 18 },
    ];

    it.each(EXPECTED_BUCKETS)(
      'diff=$diff → games_to_win=$stronger_win, games_to_lose=$stronger_lose',
      ({ diff, stronger_win, stronger_lose }) => {
        const out = gamesNeeded5v5FormulaChart.compute(diff);
        expect(out.games_to_win).toBe(stronger_win);
        expect(out.games_to_lose).toBe(stronger_lose);
        expect(out.games_to_tie).toBeNull();
      },
    );
  });

  describe('Step 6: all three implementations agree everywhere', () => {
    it.each(REPRESENTATIVE_DIFFS)(
      'diff %i: three implementations agree (transitive equivalence)',
      (diff) => {
        const oldOut = get5v5GamesNeeded(diff);
        const tableOut = gamesNeeded5v5Chart.compute(diff);
        const formulaOut = gamesNeeded5v5FormulaChart.compute(diff);
        expect(tableOut).toEqual(oldOut);
        expect(formulaOut).toEqual(oldOut);
        expect(formulaOut).toEqual(tableOut);
      },
    );
  });
});
