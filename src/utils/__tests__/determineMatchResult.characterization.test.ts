/**
 * @fileoverview Characterization tests for determineMatchResult.
 *
 * Locks the match-result determination logic that was previously a private
 * function inside `src/components/scoring/MatchEndVerification.tsx`. Now
 * extracted to `src/utils/determineMatchResult.ts` for unit-testability.
 *
 * The function takes (homeWins, awayWins, thresholds for both sides) and
 * returns 'home_win' | 'away_win' | 'tie'. Decision rules:
 *
 *   1. home reaches its win threshold → home_win (precedence over everything)
 *   2. away reaches its win threshold → away_win
 *   3. Both teams' wins equal their tie thresholds (and tie thresholds
 *      exist for both) → tie
 *   4. Otherwise → 'tie' as the fallback (defensive default;
 *      shouldn't be reachable when all games are complete and thresholds
 *      are coherent)
 *
 * This function is consumed by MatchEndVerification at match-end time;
 * any silent change here would corrupt the recorded match result.
 *
 * Locked here so the modular-league refactor (Phase 5 — restructuring
 * threshold output union, Unit 5.2 MatchEndVerification refactor) cannot
 * change the result-determination semantics without explicitly updating
 * the locked behavior.
 */

import { describe, it, expect } from 'vitest';
import { determineMatchResult } from '../determineMatchResult';

describe('determineMatchResult — characterization', () => {
  describe('home wins (home reaches win threshold first)', () => {
    it('home reaches exactly its win threshold → home_win', () => {
      // BCA 3v3 example: home_win=10, away_win=10
      expect(determineMatchResult(10, 8, 10, 10, 9, 9)).toBe('home_win');
    });

    it('home exceeds its win threshold → home_win', () => {
      expect(determineMatchResult(12, 6, 10, 10, 9, 9)).toBe('home_win');
    });

    it('home win takes precedence over away win in the same call (impossible in practice but locked)', () => {
      // If both teams somehow reached their thresholds, home wins (first
      // condition checked). This is defensive — under normal scoring this
      // can never both be true at the same time.
      expect(determineMatchResult(10, 10, 10, 10, null, null)).toBe('home_win');
    });
  });

  describe('away wins (away reaches threshold; home has not)', () => {
    it('away reaches exactly its win threshold → away_win', () => {
      expect(determineMatchResult(8, 10, 10, 10, 9, 9)).toBe('away_win');
    });

    it('away exceeds its threshold → away_win', () => {
      expect(determineMatchResult(6, 12, 10, 10, 9, 9)).toBe('away_win');
    });

    it('asymmetric thresholds: home needs 12, away needs 7 — away at 7 wins', () => {
      // Heavily-handicapped scenario: lower-skill team needs fewer games
      expect(determineMatchResult(5, 7, 12, 7, 11, 6)).toBe('away_win');
    });
  });

  describe('tie (chart-defined tie configuration met)', () => {
    it('both teams at exactly their tie thresholds → tie', () => {
      // BCA 3v3 even-match: home_tie=9, away_tie=9, both at 9-9
      expect(determineMatchResult(9, 9, 10, 10, 9, 9)).toBe('tie');
    });

    it('asymmetric tie configuration: home_tie=11, away_tie=7 → tie at exactly those values', () => {
      expect(determineMatchResult(11, 7, 12, 8, 11, 7)).toBe('tie');
    });

    it('home tie threshold met but away below away_tie → fallthrough to "tie" (defensive default)', () => {
      // 9-7 with both tie thresholds at 9 — only home matches the tie target.
      // Falls through to the bottom default 'tie'. Locked here even though
      // it shouldn't happen with complete games.
      expect(determineMatchResult(9, 7, 10, 10, 9, 9)).toBe('tie');
    });

    it('away tie threshold met but home below home_tie → fallthrough to "tie"', () => {
      expect(determineMatchResult(7, 9, 10, 10, 9, 9)).toBe('tie');
    });
  });

  describe('null tie thresholds (chart entry has no tie possible)', () => {
    it('null thresholds + neither team at win → fallthrough "tie" default', () => {
      // BCA 5v5 / Fargo: ties impossible at the chart level.
      // If neither team reached their win threshold, fall through to the
      // default 'tie' return. In practice this means an incomplete match
      // (the games aren't all played yet).
      expect(determineMatchResult(7, 8, 13, 13, null, null)).toBe('tie');
    });

    it('null tie + home wins → home_win (still reaches win condition)', () => {
      expect(determineMatchResult(13, 12, 13, 13, null, null)).toBe('home_win');
    });

    it('null tie + away wins → away_win', () => {
      expect(determineMatchResult(12, 13, 13, 13, null, null)).toBe('away_win');
    });

    it('only home tie is null (asymmetric chart row) → falls through to default tie', () => {
      // Defensive: this shouldn't happen in practice (chart should have
      // null/non-null consistent across home/away for the same diff), but
      // the function handles the case by requiring BOTH non-null to return tie.
      expect(determineMatchResult(8, 8, 10, 10, null, 8)).toBe('tie');
    });

    it('only away tie is null → falls through to default tie', () => {
      expect(determineMatchResult(8, 8, 10, 10, 8, null)).toBe('tie');
    });
  });

  describe('zero wins / zero thresholds edge cases', () => {
    it('home win threshold of 0 with zero wins → home_win immediately (degenerate but locked)', () => {
      // Thresholds of 0 are non-physical but the predicate `homeWins >= 0`
      // is always true. Lock the behavior so any future refactor that adds
      // bounds-checking can be detected.
      expect(determineMatchResult(0, 0, 0, 10, null, null)).toBe('home_win');
    });

    it('zero wins both teams with positive thresholds → tie default', () => {
      // No games played yet. Falls through to default. This is what the
      // running scoreboard sees mid-match before any game is scored.
      expect(determineMatchResult(0, 0, 10, 10, 9, 9)).toBe('tie');
    });
  });

  describe('Fargo-style thresholds (no tie possible — both null)', () => {
    /**
     * Fargo 5v5 plays all 25 games regardless. The threshold here uses the
     * tied "games_to_win" (whoever has more wins among the cascade) but
     * the tie thresholds are always null. For partial-match scoring,
     * neither team has reached their threshold yet → falls through to
     * 'tie' default. Final-match scoring uses the points → games-won
     * cascade in fargo5v5.scoring.computeMatchResult instead, which is
     * separately locked in `src/systems/__tests__/fargo5v5.test.ts`.
     */
    it('mid-match Fargo running totals → "tie" default (correct behavior, decided later by cascade)', () => {
      expect(determineMatchResult(5, 6, 13, 13, null, null)).toBe('tie');
    });

    it('Fargo final 13-12 → home_win', () => {
      expect(determineMatchResult(13, 12, 13, 13, null, null)).toBe('home_win');
    });

    it('Fargo final 12-13 → away_win', () => {
      expect(determineMatchResult(12, 13, 13, 13, null, null)).toBe('away_win');
    });
  });
});
