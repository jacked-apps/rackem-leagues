/**
 * @fileoverview Unit tests for MatchPhaseGuard's redirect dispatch table.
 *
 * Pins the lineup ⇄ scoring redirect rules — including the tiebreaker-window
 * exception that fixes the "Both team lineups must be locked before scoring can
 * begin" error a tied match hit when the guard bounced captains off the
 * tiebreak lineup page.
 */
import { describe, it, expect } from 'vitest';
import { computePhaseRedirect } from '../MatchPhaseGuard';

describe('computePhaseRedirect', () => {
  describe('lineup phase (scheduled / updating)', () => {
    it('bounces /score → lineup while scheduled', () => {
      expect(computePhaseRedirect('scheduled', null, '/match/m1/score')).toBe('lineup');
    });

    it('bounces /score → lineup while an operator is hand-entering (updating)', () => {
      expect(computePhaseRedirect('updating', null, '/match/m1/score')).toBe('lineup');
    });

    it('leaves a user already on /lineup alone while scheduled', () => {
      expect(computePhaseRedirect('scheduled', null, '/match/m1/lineup')).toBeNull();
    });
  });

  describe('scoring phase (in_progress)', () => {
    it('pushes /lineup → score once the match is in progress', () => {
      expect(computePhaseRedirect('in_progress', null, '/match/m1/lineup')).toBe('score');
    });

    it('leaves a user already on /score alone', () => {
      expect(computePhaseRedirect('in_progress', null, '/match/m1/score')).toBeNull();
    });
  });

  describe('tiebreaker window (in_progress + match_result = tie)', () => {
    it('does NOT push /lineup → score — captains re-pick the tiebreak lineup there', () => {
      // The bug: without this exception the guard bounced them to /score, where
      // the unlocked tiebreak lineups threw the lineup-lock error.
      expect(computePhaseRedirect('in_progress', 'tie', '/match/m1/lineup')).toBeNull();
    });

    it('leaves a user on /score alone during the tiebreaker (scoring the tiebreaker)', () => {
      expect(computePhaseRedirect('in_progress', 'tie', '/match/m1/score')).toBeNull();
    });
  });

  describe('terminal + edge states', () => {
    it('does not redirect once a decided result is set (home_win/away_win)', () => {
      expect(computePhaseRedirect('in_progress', 'home_win', '/match/m1/lineup')).toBe('score');
      // completed matches fall through to children — no redirect either way.
      expect(computePhaseRedirect('completed', 'away_win', '/match/m1/score')).toBeNull();
    });

    it('returns null when status is undefined (data not loaded yet)', () => {
      expect(computePhaseRedirect(undefined, null, '/match/m1/lineup')).toBeNull();
    });

    it('does not redirect on non-lineup/non-score paths', () => {
      expect(computePhaseRedirect('in_progress', null, '/match/m1')).toBeNull();
    });
  });
});
