/**
 * @fileoverview Tests for the FargoRate Formula Chart variant.
 *
 * Module-level test for the start-points formula. The validated real-match
 * anchor case (117-point rating gap → 56 start points) is preserved from
 * `src/systems/__tests__/fargo5v5.test.ts`'s threshold.compute coverage.
 *
 * @see ../fargo-formula.ts — the variant under test
 * @see docs/research/fargorate-formula.md — calibration source
 */

import { describe, it, expect } from 'vitest';
import { fargoFormulaChart } from '../fargo-formula';
import type { SystemOverrides } from '@/types/systemOverrides';

const EMPTY_OVERRIDES: SystemOverrides = {};

describe('fargoFormulaChart — FargoRate Formula start-points Chart', () => {
  describe('module identity', () => {
    it('kind is "fargo_formula"', () => {
      expect(fargoFormulaChart.kind).toBe('fargo_formula');
    });
  });

  describe('compute — validated real-match test case', () => {
    // Test Case 1 from docs/research/fargorate-formula.md:
    // Home: 567, 458, 493, 486, 574 (avg 515.6)
    // Away: 447, 394, 452, 322, 374 (avg 397.8)
    // Official FargoRate calculator → 56 start points to away (the weaker team).
    it('117-point rating gap produces 56 start points to the weaker team', () => {
      const result = fargoFormulaChart.compute(
        [567, 458, 493, 486, 574],
        [447, 394, 452, 322, 374],
        EMPTY_OVERRIDES,
      );
      expect(result.startPointsForWeakerTeam).toBe(56);
      expect(result.weakerTeam).toBe('away');
    });
  });

  describe('compute — symmetric (zero gap)', () => {
    it('equal lineups produce 0 start points and weakerTeam="even"', () => {
      const result = fargoFormulaChart.compute(
        [500, 500, 500, 500, 500],
        [500, 500, 500, 500, 500],
        EMPTY_OVERRIDES,
      );
      expect(result.startPointsForWeakerTeam).toBe(0);
      expect(result.weakerTeam).toBe('even');
    });
  });

  describe('compute — weakerTeam direction', () => {
    it('routes start points to home when home is the weaker side', () => {
      const result = fargoFormulaChart.compute(
        [400, 400, 400, 400, 400], // weaker
        [600, 600, 600, 600, 600], // stronger
        EMPTY_OVERRIDES,
      );
      expect(result.startPointsForWeakerTeam).toBeGreaterThan(0);
      expect(result.weakerTeam).toBe('home');
    });

    it('routes start points to away when away is the weaker side', () => {
      const result = fargoFormulaChart.compute(
        [600, 600, 600, 600, 600], // stronger
        [400, 400, 400, 400, 400], // weaker
        EMPTY_OVERRIDES,
      );
      expect(result.startPointsForWeakerTeam).toBeGreaterThan(0);
      expect(result.weakerTeam).toBe('away');
    });
  });

  describe('compute — roster-agnostic (works for any lineup size)', () => {
    it('handles 3v3 rosters', () => {
      const result = fargoFormulaChart.compute(
        [600, 600, 600],
        [400, 400, 400],
        EMPTY_OVERRIDES,
      );
      expect(result.weakerTeam).toBe('away');
      expect(result.startPointsForWeakerTeam).toBeGreaterThan(0);
    });

    it('handles asymmetric lineup sizes (e.g., 3 vs 4)', () => {
      const result = fargoFormulaChart.compute(
        [500, 500, 500],
        [500, 500, 500, 500],
        EMPTY_OVERRIDES,
      );
      // Same per-player rating, asymmetric totals — weaker team is the smaller side.
      expect(result.weakerTeam).toBe('home');
    });
  });

  describe('compute — winner_points override is honored', () => {
    it('override shifts the start-points magnitude proportionally', () => {
      const baseline = fargoFormulaChart.compute(
        [600, 600, 600, 600, 600],
        [400, 400, 400, 400, 400],
        EMPTY_OVERRIDES,
      );
      const overridden = fargoFormulaChart.compute(
        [600, 600, 600, 600, 600],
        [400, 400, 400, 400, 400],
        { winner_points: 20 },
      );
      // Higher winner_points → larger per-game spread → more start points.
      expect(overridden.startPointsForWeakerTeam).toBeGreaterThan(
        baseline.startPointsForWeakerTeam,
      );
    });
  });

  describe('compute — error cases', () => {
    it('throws on empty home ratings', () => {
      expect(() => fargoFormulaChart.compute([], [500], EMPTY_OVERRIDES)).toThrow(
        /non-empty/,
      );
    });

    it('throws on empty away ratings', () => {
      expect(() => fargoFormulaChart.compute([500], [], EMPTY_OVERRIDES)).toThrow(
        /non-empty/,
      );
    });

    it('throws on non-finite home rating', () => {
      expect(() =>
        fargoFormulaChart.compute([500, NaN], [500], EMPTY_OVERRIDES),
      ).toThrow(/non-finite home/);
    });

    it('throws on non-finite away rating', () => {
      expect(() =>
        fargoFormulaChart.compute([500], [500, Infinity], EMPTY_OVERRIDES),
      ).toThrow(/non-finite away/);
    });
  });
});
