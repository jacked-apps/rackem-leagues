/**
 * @fileoverview Cross-audit: 3v3 Games-Needed formula Module vs. existing chart.
 *
 * Ed's methodology: three implementations of the same Chart must produce
 * identical outputs at every input.
 *
 *   1. Old chart (legacy):  `get3v3GamesNeeded` TS lookup table — source of truth.
 *   2. New chart (Module):  `gamesNeeded3v3Chart` from Phase A — wraps the TS table.
 *   3. New formula (Module): `gamesNeeded3v3FormulaChart` — Ed-provided formulas
 *      implemented byte-exact, parameterized by game_count.
 *
 * If all three agree row-for-row, the formula is validated and Phase A.5 is
 * solid. If they disagree, the test fails loudly and surfaces exactly which
 * input diverges — no guessing, no "correcting."
 *
 * @see ../games-needed-3v3-formula.ts — the Module under audit
 * @see ../games-needed-3v3.ts — the table-shape companion
 */

import { describe, it, expect } from 'vitest';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import { gamesNeeded3v3Chart } from '../games-needed-3v3';
import { gamesNeeded3v3FormulaChart } from '../games-needed-3v3-formula';

const GAME_COUNT_3V3 = 18;
const ALL_DIFFS_IN_RANGE = Array.from({ length: 25 }, (_, i) => i - 12); // -12..+12

describe('Cross-audit: 3v3 Games-Needed — old chart / new chart Module / new formula Module', () => {
  describe('Step 1: old chart vs. new chart Module — byte-equivalence', () => {
    it.each(ALL_DIFFS_IN_RANGE)(
      'diff %i: old chart === new chart Module',
      (diff) => {
        expect(gamesNeeded3v3Chart.compute(diff)).toEqual(get3v3GamesNeeded(diff));
      },
    );
  });

  describe('Step 2: new formula Module vs. old chart — formula reproduces the chart', () => {
    it.each(ALL_DIFFS_IN_RANGE)(
      'diff %i: formula Module.compute === chart row-for-row (all 3 fields)',
      (diff) => {
        expect(gamesNeeded3v3FormulaChart.compute(diff)).toEqual(
          get3v3GamesNeeded(diff),
        );
      },
    );
  });

  describe("Step 3: Ed's sum-invariant rule", () => {
    // Tie situation: winning thresholds (tie value when allowed) sum to game_count.
    // Non-tie situation: winning thresholds (win value) sum to game_count + 1.
    const POSITIVE_DIFFS = Array.from({ length: 13 }, (_, i) => i); // 0..12

    it.each(POSITIVE_DIFFS)(
      'diff=+%i: sum rule holds (tie → 18, non-tie → 19)',
      (diff) => {
        const stronger = gamesNeeded3v3FormulaChart.compute(diff);
        const weaker = gamesNeeded3v3FormulaChart.compute(-diff);
        const tiePossible =
          stronger.games_to_tie !== null && weaker.games_to_tie !== null;

        if (tiePossible) {
          const sum =
            (stronger.games_to_tie as number) + (weaker.games_to_tie as number);
          expect(sum).toBe(GAME_COUNT_3V3);
        } else {
          expect(stronger.games_to_win + weaker.games_to_win).toBe(
            GAME_COUNT_3V3 + 1,
          );
        }
      },
    );
  });

  describe('Step 4: diff cap at |12|', () => {
    it('diff=+20 produces the same output as diff=+12 (capped)', () => {
      expect(gamesNeeded3v3FormulaChart.compute(20)).toEqual(
        gamesNeeded3v3FormulaChart.compute(12),
      );
    });

    it('diff=-50 produces the same output as diff=-12 (capped)', () => {
      expect(gamesNeeded3v3FormulaChart.compute(-50)).toEqual(
        gamesNeeded3v3FormulaChart.compute(-12),
      );
    });

    it('formula Module matches old chart even past the cap', () => {
      // The old chart also caps at ±12 (uses Math.max/min); formula should agree.
      expect(gamesNeeded3v3FormulaChart.compute(100)).toEqual(
        get3v3GamesNeeded(100),
      );
      expect(gamesNeeded3v3FormulaChart.compute(-100)).toEqual(
        get3v3GamesNeeded(-100),
      );
    });
  });

  describe('Step 5: all three implementations agree everywhere', () => {
    // The full three-way audit: old chart == new chart Module == new formula Module.
    it.each(ALL_DIFFS_IN_RANGE)(
      'diff %i: three implementations agree (transitive equivalence)',
      (diff) => {
        const oldOut = get3v3GamesNeeded(diff);
        const tableOut = gamesNeeded3v3Chart.compute(diff);
        const formulaOut = gamesNeeded3v3FormulaChart.compute(diff);
        expect(tableOut).toEqual(oldOut);
        expect(formulaOut).toEqual(oldOut);
        expect(formulaOut).toEqual(tableOut);
      },
    );
  });
});
