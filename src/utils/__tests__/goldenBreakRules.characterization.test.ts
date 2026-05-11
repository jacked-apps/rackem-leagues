/**
 * @fileoverview Characterization tests for shouldGoldenBreakCount.
 *
 * Locks the BCA-standard golden-break rule plus the league/org override
 * cascade. The rule is per-game-type:
 *
 *   - 8-ball: golden break does NOT count as a win
 *   - 9-ball: golden break DOES count as a win
 *   - 10-ball: golden break DOES count as a win
 *
 * Plus a per-league `golden_break_counts_as_win` preference that
 * overrides the BCA standard when set (true / false). Null or undefined
 * means "no override, use BCA standard."
 *
 * Locked here so the modular-league refactor (where this preference
 * becomes one of the 13 modular axes — R12 in the brainstorm) doesn't
 * accidentally change the cascade behavior or the BCA-standard defaults
 * when the override is absent.
 */

import { describe, it, expect } from 'vitest';
import { shouldGoldenBreakCount } from '../goldenBreakRules';
import type { GameType } from '@/types/league';

describe('shouldGoldenBreakCount — characterization', () => {
  describe('BCA standard defaults (no preference set)', () => {
    it('8-ball with null preference → false (does NOT count)', () => {
      expect(shouldGoldenBreakCount('eight_ball', null)).toBe(false);
    });

    it('8-ball with undefined preference → false (does NOT count)', () => {
      expect(shouldGoldenBreakCount('eight_ball', undefined)).toBe(false);
    });

    it('9-ball with null preference → true (counts)', () => {
      expect(shouldGoldenBreakCount('nine_ball', null)).toBe(true);
    });

    it('9-ball with undefined preference → true (counts)', () => {
      expect(shouldGoldenBreakCount('nine_ball', undefined)).toBe(true);
    });

    it('10-ball with null preference → true (counts)', () => {
      expect(shouldGoldenBreakCount('ten_ball', null)).toBe(true);
    });

    it('10-ball with undefined preference → true (counts)', () => {
      expect(shouldGoldenBreakCount('ten_ball', undefined)).toBe(true);
    });
  });

  describe('explicit override (preference value wins over BCA standard)', () => {
    it.each<[GameType, boolean]>([
      ['eight_ball', true],
      ['eight_ball', false],
      ['nine_ball', true],
      ['nine_ball', false],
      ['ten_ball', true],
      ['ten_ball', false],
    ])('%s with explicit %s preference → %s', (gameType, pref) => {
      expect(shouldGoldenBreakCount(gameType, pref)).toBe(pref);
    });
  });

  describe('override-vs-default boundary cases', () => {
    it('8-ball with explicit true overrides BCA "no count" default', () => {
      expect(shouldGoldenBreakCount('eight_ball', true)).toBe(true);
    });

    it('9-ball with explicit false overrides BCA "counts" default', () => {
      expect(shouldGoldenBreakCount('nine_ball', false)).toBe(false);
    });
  });

  describe('safe default for unrecognized game types', () => {
    it('unknown game type with no preference → false (safe default)', () => {
      // Casting to GameType to bypass the literal-union check; in practice
      // the type system prevents this, but defensive runtime fallback is
      // worth locking.
      expect(shouldGoldenBreakCount('unknown_game_type' as GameType, null)).toBe(false);
    });

    it('unknown game type with explicit override → uses override', () => {
      expect(shouldGoldenBreakCount('unknown_game_type' as GameType, true)).toBe(true);
      expect(shouldGoldenBreakCount('unknown_game_type' as GameType, false)).toBe(false);
    });
  });
});
