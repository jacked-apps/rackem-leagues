/**
 * @fileoverview Characterization PARITY tests — the cutover safety gate.
 *
 * Proves the new judge (`buildWinCalcConfig` + `decideWinner`) reproduces today's
 * live winner behavior 1:1, BEFORE anything is swapped (Unit 6):
 *   - games-mode oracle: `determineMatchResult` (the current games cascade)
 *   - points-mode oracle: the inline `MatchEndVerification` ternary, replicated here
 *
 * Two outcomes legitimately diverge — both unreachable with correct/odd-game
 * config — and are asserted explicitly rather than as parity matches:
 *   - both sides clear their games-target (malformed targets): legacy picks home
 *     (checked first); the new judge names no winner + flags it.
 *   - points AND games both equal (even-game points formats): legacy picks home
 *     (homeWins >= awayWins); the new judge ties (residue → tie-resolution module).
 */
import { describe, it, expect } from 'vitest';
import { determineMatchResult, type MatchResultOutcome } from '@/utils/determineMatchResult';
import { buildWinCalcConfig } from '../configs';
import { decideWinner } from '../judge';
import type { WinCalcState } from '../types';

const baseState: WinCalcState = {
  home_games: 0,
  away_games: 0,
  home_points: 0,
  away_points: 0,
  home_games_target: null,
  away_games_target: null,
  home_points_target: null,
  away_points_target: null,
  edge: null,
};

/** Map the new judge's verdict to the legacy outcome string for comparison. */
function verdictAsLegacy(s: WinCalcState, winCondition: string): MatchResultOutcome {
  const v = decideWinner(s, buildWinCalcConfig(winCondition)).verdict;
  if ('winner' in v) return v.winner === 'home' ? 'home_win' : 'away_win';
  return 'tie';
}

/** Legacy games oracle. Tie thresholds never change the outcome (non-win → 'tie'), so pass null. */
function gamesOracle(hw: number, aw: number, hT: number, aT: number): MatchResultOutcome {
  return determineMatchResult(hw, aw, hT, aT, null, null);
}

/** Legacy points oracle — the inline MatchEndVerification ternary, verbatim. */
function pointsOracle(hp: number, ap: number, hw: number, aw: number): MatchResultOutcome {
  if (hp === ap) return hw >= aw ? 'home_win' : 'away_win';
  return hp > ap ? 'home_win' : 'away_win';
}

describe('Win Calculator parity — games (win_condition="games")', () => {
  const cases = [
    { name: 'BCA symmetric, home clears target', hw: 10, aw: 8, hT: 10, aT: 10 },
    { name: 'BCA symmetric, away clears target', hw: 8, aw: 10, hT: 10, aT: 10 },
    { name: 'BCA tie (9-9, neither clears)', hw: 9, aw: 9, hT: 10, aT: 10 },
    { name: 'handicap asymmetric, strong side clears', hw: 11, aw: 7, hT: 11, aT: 8 },
    { name: 'handicap asymmetric, weak side clears', hw: 9, aw: 9, hT: 11, aT: 8 },
    { name: 'tiebreaker re-entry best-of-3, home', hw: 2, aw: 0, hT: 2, aT: 2 },
    { name: 'tiebreaker re-entry best-of-3, away', hw: 1, aw: 2, hT: 2, aT: 2 },
  ];

  it.each(cases)('$name → judge matches determineMatchResult', ({ hw, aw, hT, aT }) => {
    const s = { ...baseState, home_games: hw, away_games: aw, home_games_target: hT, away_games_target: aT };
    expect(verdictAsLegacy(s, 'games')).toBe(gamesOracle(hw, aw, hT, aT));
  });
});

describe('Win Calculator parity — points (win_condition="points")', () => {
  const cases = [
    { name: 'home more points', hp: 50, ap: 40, hw: 6, aw: 9 },
    { name: 'away more points', hp: 40, ap: 50, hw: 9, aw: 6 },
    { name: 'points equal, home more games', hp: 45, ap: 45, hw: 13, aw: 12 },
    { name: 'points equal, away more games', hp: 45, ap: 45, hw: 12, aw: 13 },
  ];

  it.each(cases)('$name → judge matches the inline points ternary', ({ hp, ap, hw, aw }) => {
    const s = { ...baseState, home_points: hp, away_points: ap, home_games: hw, away_games: aw };
    expect(verdictAsLegacy(s, 'points')).toBe(pointsOracle(hp, ap, hw, aw));
  });
});

describe('Win Calculator parity — documented divergences (unreachable with correct config)', () => {
  it('both sides clear their games-target: legacy → home, new judge → tie + flag', () => {
    // targets 10/8 in an 18-game match → both can clear (a malformed chart)
    const s = { ...baseState, home_games: 10, away_games: 8, home_games_target: 10, away_games_target: 8 };
    expect(gamesOracle(10, 8, 10, 8)).toBe('home_win'); // legacy checks home first
    const r = decideWinner(s, buildWinCalcConfig('games'));
    expect(r.verdict).toEqual({ tie: true }); // new judge names no single winner
    expect(r.flags.length).toBeGreaterThan(0); // ...and surfaces it
  });

  it('points AND games both equal: legacy → home, new judge → tie', () => {
    const s = { ...baseState, home_points: 45, away_points: 45, home_games: 9, away_games: 9 };
    expect(pointsOracle(45, 45, 9, 9)).toBe('home_win'); // legacy: homeWins >= awayWins → home
    expect(decideWinner(s, buildWinCalcConfig('points')).verdict).toEqual({ tie: true });
  });
});
