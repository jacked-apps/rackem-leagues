/**
 * @fileoverview Tests for the Percentage Handicap System variant.
 *
 * Mirrors the rating.displayFormat + rating.validate test sections from
 * `src/systems/__tests__/bca5v5.characterization.test.ts`.
 *
 * @see ../percentage.ts — the variant under test
 */

import { describe, it, expect } from 'vitest';
import { percentageHandicapSystem } from '../percentage';

describe('percentageHandicapSystem — Percentage handicap variant', () => {
  describe('module identity', () => {
    it('kind is "percentage"', () => {
      expect(percentageHandicapSystem.kind).toBe('percentage');
    });

    it('requiresManualEntry is false (Percentage is internally-computed)', () => {
      expect(percentageHandicapSystem.requiresManualEntry).toBe(false);
    });

    it('computeFromHistory is intentionally omitted (Phase A scope)', () => {
      expect(percentageHandicapSystem.computeFromHistory).toBeUndefined();
    });
  });

  describe('displayFormat — 0..100 with rounded percent', () => {
    it.each([
      [0, '0%'],
      [30, '30%'],
      [50, '50%'],
      [85, '85%'],
      [100, '100%'],
      [33.7, '34%'], // rounded
      [49.4, '49%'], // rounded
    ])('value %f displays as "%s"', (value, expected) => {
      expect(percentageHandicapSystem.displayFormat(value)).toBe(expected);
    });
  });

  describe('validate', () => {
    it.each([0, 25, 50, 75, 100, 33.5])('accepts valid number %f', (value) => {
      expect(percentageHandicapSystem.validate(value)).toEqual({ ok: true, value });
    });

    it('rejects strings', () => {
      expect(percentageHandicapSystem.validate('50')).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it('rejects null', () => {
      expect(percentageHandicapSystem.validate(null)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it('rejects NaN', () => {
      expect(percentageHandicapSystem.validate(NaN)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it.each([-1, -0.1, 100.01, 101, 1000])('rejects out-of-range value %f', (value) => {
      expect(percentageHandicapSystem.validate(value)).toEqual({
        ok: false,
        message: 'Percentage handicap must be between 0 and 100',
      });
    });
  });
});
