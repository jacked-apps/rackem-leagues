/**
 * @fileoverview Tests for the Points Handicap System variant.
 *
 * Mirrors the rating.displayFormat + rating.validate test sections from
 * `src/systems/__tests__/bca3v3.characterization.test.ts` — when Phase B wires
 * the Module field into SystemModule, those characterization tests will
 * effectively exercise this same code path. Keeping a dedicated test here
 * locks the Module's behavior independently of any SystemModule wiring.
 *
 * @see ../points.ts — the variant under test
 */

import { describe, it, expect } from 'vitest';
import { pointsHandicapSystem } from '../points';

describe('pointsHandicapSystem — Points handicap variant', () => {
  describe('module identity', () => {
    it('kind is "points"', () => {
      expect(pointsHandicapSystem.kind).toBe('points');
    });

    it('requiresManualEntry is false (Points is internally-computed)', () => {
      expect(pointsHandicapSystem.requiresManualEntry).toBe(false);
    });

    it('computeFromHistory is intentionally omitted (Phase A scope)', () => {
      expect(pointsHandicapSystem.computeFromHistory).toBeUndefined();
    });
  });

  describe('displayFormat — points handicap range -2..+2', () => {
    it.each([
      [-2, '-2'],
      [-1, '-1'],
      [0, '0'],
      [1, '+1'],
      [2, '+2'],
    ])('value %i displays as "%s"', (value, expected) => {
      expect(pointsHandicapSystem.displayFormat(value)).toBe(expected);
    });
  });

  describe('validate', () => {
    it.each([-2, -1, 0, 1, 2])('accepts valid integer %i', (value) => {
      expect(pointsHandicapSystem.validate(value)).toEqual({ ok: true, value });
    });

    it('rejects strings', () => {
      expect(pointsHandicapSystem.validate('1')).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it('rejects null', () => {
      expect(pointsHandicapSystem.validate(null)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it('rejects undefined', () => {
      expect(pointsHandicapSystem.validate(undefined)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it('rejects NaN', () => {
      expect(pointsHandicapSystem.validate(NaN)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it.each([Infinity, -Infinity])('rejects %s', (value) => {
      expect(pointsHandicapSystem.validate(value)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it.each([0.5, 1.5, -1.5, 0.1])('rejects fractional %f', (value) => {
      expect(pointsHandicapSystem.validate(value)).toEqual({
        ok: false,
        message: 'Points handicap must be an integer',
      });
    });

    it.each([-3, 3, -100, 100])('rejects out-of-range integer %i', (value) => {
      expect(pointsHandicapSystem.validate(value)).toEqual({
        ok: false,
        message: 'Points handicap must be between -2 and +2',
      });
    });
  });
});
