/**
 * @fileoverview Tests for `realPairsForStyle` — the place-based seed pairing that
 * drives the REAL playoff matches (Unit 3 of the playoff-review-page plan).
 *
 * This is the fix that makes the configured matchup style actually reach the
 * match records, instead of the old hardcoded seeded pairing. Pure logic, no DB.
 */

import { describe, it, expect } from 'vitest';
import { realPairsForStyle } from './playoffGenerator';

describe('realPairsForStyle', () => {
  it('seeded → 1 vs last, 2 vs 2nd-last, … (8 teams)', () => {
    expect(realPairsForStyle(8, 'seeded')).toEqual([
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ]);
  });

  it('ranked → adjacent pairs 1v2, 3v4, … (8 teams)', () => {
    expect(realPairsForStyle(8, 'ranked')).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
  });

  it('defaults to seeded when no style is given', () => {
    expect(realPairsForStyle(8)).toEqual(realPairsForStyle(8, 'seeded'));
  });

  it("'bracket' (multi-week) falls back to seeded, never throws", () => {
    expect(realPairsForStyle(8, 'bracket')).toEqual(realPairsForStyle(8, 'seeded'));
  });

  it('unknown style value falls back to seeded, never throws', () => {
    // Exercise the safety fallback for an unexpected value.
    expect(realPairsForStyle(8, 'nonsense' as never)).toEqual(
      realPairsForStyle(8, 'seeded'),
    );
  });

  it('random → 4 valid pairs using every seed 1..8 exactly once', () => {
    const pairs = realPairsForStyle(8, 'random');
    expect(pairs).toHaveLength(4);
    const seeds = pairs.flat().sort((a, b) => a - b);
    expect(seeds).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // Home/away convention: lower seed number is home.
    for (const [home, away] of pairs) {
      expect(home).toBeLessThan(away);
    }
  });

  it('works for a 4-team bracket (seeded)', () => {
    expect(realPairsForStyle(4, 'seeded')).toEqual([
      [1, 4],
      [2, 3],
    ]);
  });

  it('returns [] for an odd or invalid bracket size (never throws)', () => {
    expect(realPairsForStyle(7, 'seeded')).toEqual([]);
    expect(realPairsForStyle(0, 'seeded')).toEqual([]);
    expect(realPairsForStyle(1, 'ranked')).toEqual([]);
  });
});
