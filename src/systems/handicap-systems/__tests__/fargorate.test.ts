/**
 * @fileoverview Tests for the FargoRate Handicap System variant.
 *
 * Mirrors the rating tests in `src/systems/__tests__/fargo5v5.test.ts`.
 *
 * @see ../fargorate.ts — the variant under test
 */

import { describe, it, expect } from 'vitest';
import { fargoRateHandicapSystem } from '../fargorate';

describe('fargoRateHandicapSystem — FargoRate handicap variant', () => {
  describe('module identity', () => {
    it('kind is "fargo"', () => {
      expect(fargoRateHandicapSystem.kind).toBe('fargo');
    });

    it('requiresManualEntry is true (FargoRate is externally-sourced)', () => {
      expect(fargoRateHandicapSystem.requiresManualEntry).toBe(true);
    });

    it('computeFromHistory returns null (no history-based derivation for FargoRate)', () => {
      const ctx = {
        playerId: 'p1',
        recentGames: [],
        weeksPlayed: 0,
      };
      expect(fargoRateHandicapSystem.computeFromHistory?.(ctx)).toBeNull();
    });
  });

  describe('displayFormat — integer rounding, no decoration', () => {
    it.each([
      [100, '100'],
      [425, '425'],
      [575, '575'],
      [850, '850'],
      [500.4, '500'], // rounded
      [500.6, '501'], // rounded
    ])('value %f displays as "%s"', (value, expected) => {
      expect(fargoRateHandicapSystem.displayFormat(value)).toBe(expected);
    });
  });

  describe('validate', () => {
    it.each([100, 200, 425, 575, 850])('accepts valid integer %i', (value) => {
      expect(fargoRateHandicapSystem.validate(value)).toEqual({ ok: true, value });
    });

    it('rejects strings', () => {
      expect(fargoRateHandicapSystem.validate('500')).toEqual({
        ok: false,
        message: 'Fargo rating must be a number',
      });
    });

    it('rejects null', () => {
      expect(fargoRateHandicapSystem.validate(null)).toEqual({
        ok: false,
        message: 'Fargo rating must be a number',
      });
    });

    it('rejects NaN', () => {
      expect(fargoRateHandicapSystem.validate(NaN)).toEqual({
        ok: false,
        message: 'Fargo rating must be a number',
      });
    });

    it.each([500.5, 425.1, 100.7])('rejects fractional %f', (value) => {
      expect(fargoRateHandicapSystem.validate(value)).toEqual({
        ok: false,
        message: 'Fargo rating must be a whole integer',
      });
    });

    it.each([99, 50, 0, 851, 1000, -100])('rejects out-of-range integer %i', (value) => {
      expect(fargoRateHandicapSystem.validate(value)).toEqual({
        ok: false,
        message: 'Fargo rating must be between 100 and 850',
      });
    });
  });
});
