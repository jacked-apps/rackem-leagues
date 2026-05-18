/**
 * @fileoverview Tests for the Skill Level Handicap System variant (RESERVED).
 *
 * Skill Level has no shipping consumer (no Scoring System uses it today), but
 * the Module ships as a complete 4-variant surface so the registry can route
 * `handicap_type='skill_level'` cleanly when an APA-integration Scoring System
 * eventually lands.
 *
 * @see ../skill-level.ts — the variant under test
 */

import { describe, it, expect } from 'vitest';
import { skillLevelHandicapSystem } from '../skill-level';

describe('skillLevelHandicapSystem — Skill Level handicap variant (reserved)', () => {
  describe('module identity', () => {
    it('kind is "skill_level"', () => {
      expect(skillLevelHandicapSystem.kind).toBe('skill_level');
    });

    it('requiresManualEntry is true (externally-sourced)', () => {
      expect(skillLevelHandicapSystem.requiresManualEntry).toBe(true);
    });

    it('computeFromHistory is undefined (no derivation defined)', () => {
      expect(skillLevelHandicapSystem.computeFromHistory).toBeUndefined();
    });
  });

  describe('displayFormat — SL-prefixed integer (APA convention)', () => {
    it.each([
      [1, 'SL1'],
      [3, 'SL3'],
      [5, 'SL5'],
      [7, 'SL7'],
      [9, 'SL9'],
      [4.4, 'SL4'], // rounded
      [6.7, 'SL7'], // rounded
    ])('value %f displays as "%s"', (value, expected) => {
      expect(skillLevelHandicapSystem.displayFormat(value)).toBe(expected);
    });
  });

  describe('validate', () => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('accepts valid integer %i', (value) => {
      expect(skillLevelHandicapSystem.validate(value)).toEqual({ ok: true, value });
    });

    it('rejects strings', () => {
      expect(skillLevelHandicapSystem.validate('5')).toEqual({
        ok: false,
        message: 'Skill Level must be a number',
      });
    });

    it('rejects null', () => {
      expect(skillLevelHandicapSystem.validate(null)).toEqual({
        ok: false,
        message: 'Skill Level must be a number',
      });
    });

    it.each([3.5, 5.5, 1.1])('rejects fractional %f', (value) => {
      expect(skillLevelHandicapSystem.validate(value)).toEqual({
        ok: false,
        message: 'Skill Level must be a whole integer',
      });
    });

    it.each([0, 10, -1, 100])('rejects out-of-range integer %i', (value) => {
      expect(skillLevelHandicapSystem.validate(value)).toEqual({
        ok: false,
        message: 'Skill Level must be between 1 and 9',
      });
    });
  });
});
