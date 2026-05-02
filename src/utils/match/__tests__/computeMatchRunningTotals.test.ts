/**
 * @fileoverview Tests for computeMatchRunningTotals — Phase 5 Unit 5.5.
 *
 * Behavior verified:
 *   - Only fully-confirmed games count
 *   - Tiebreaker games are excluded from regular running totals
 *   - Aggregate calculators receive (gamesWon, thresholds) per side
 *   - Per-game calculators receive the full filtered games array
 *   - null points_calculator → zero points
 *   - Unknown points_calculator → warn + zero points (game counts still update)
 *   - Tie-band rule preserved: 9-9 in 18-game match with linear_above_threshold
 *     → 0 / 0 (the locked invariant from supplement Section 4)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeMatchRunningTotals } from '../computeMatchRunningTotals';
import type { MinimalMatchGame } from '../computeMatchRunningTotals';
import {
  registerTestedPresetCalculators,
  clearRegistry,
} from '@/systems/calculators';

const HOME = 'team-home-id';
const AWAY = 'team-away-id';

const HOME_THRESHOLDS = { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 };
const AWAY_THRESHOLDS = { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 };

/** Build a confirmed regular game with the given winner team. */
function regularGame(winner: string | null, ballsPocketed: number | null = null): MinimalMatchGame {
  return {
    winner_team_id: winner,
    loser_balls_pocketed: ballsPocketed,
    is_tiebreaker: false,
    confirmed_by_home: 'home-member-id',
    confirmed_by_away: 'away-member-id',
  };
}

function unconfirmedGame(winner: string): MinimalMatchGame {
  return {
    winner_team_id: winner,
    loser_balls_pocketed: null,
    is_tiebreaker: false,
    confirmed_by_home: 'home-member-id',
    confirmed_by_away: null,
  };
}

function tiebreakerGame(winner: string): MinimalMatchGame {
  return {
    winner_team_id: winner,
    loser_balls_pocketed: null,
    is_tiebreaker: true,
    confirmed_by_home: 'home-member-id',
    confirmed_by_away: 'away-member-id',
  };
}

describe('computeMatchRunningTotals', () => {
  beforeEach(() => {
    clearRegistry();
    registerTestedPresetCalculators();
  });

  afterEach(() => {
    clearRegistry();
  });

  describe('confirmation filtering', () => {
    it('counts only fully-confirmed games', () => {
      const games = [
        regularGame(HOME),
        regularGame(HOME),
        unconfirmedGame(HOME),
        regularGame(AWAY),
      ];

      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games,
        pointsCalculator: 'linear_above_threshold',
        pointsCalculatorParams: {},
      });

      expect(result.home_games_won).toBe(2);
      expect(result.away_games_won).toBe(1);
    });

    it('returns zero game counts when no games are confirmed (points reflect 0-wins via the calculator)', () => {
      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games: [unconfirmedGame(HOME), unconfirmedGame(AWAY)],
        pointsCalculator: 'linear_above_threshold',
        pointsCalculatorParams: {},
      });

      expect(result.home_games_won).toBe(0);
      expect(result.away_games_won).toBe(0);
      // 0 wins is below tie band (games_to_tie=9): formula gives (0 - 9) * 1 = -9
      // for both sides. The calculator's behavior at 0 wins is well-defined and
      // intentional — the running-total writer is responsible for displaying
      // "match in progress" in the UI rather than treating 0 wins as a final
      // score.
      expect(result.home_points_earned).toBe(-9);
      expect(result.away_points_earned).toBe(-9);
    });
  });

  describe('tiebreaker exclusion', () => {
    it('excludes tiebreaker games from regular running totals', () => {
      const games = [
        regularGame(HOME),
        regularGame(HOME),
        regularGame(AWAY),
        tiebreakerGame(AWAY),
        tiebreakerGame(AWAY),
      ];

      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games,
        pointsCalculator: 'linear_above_threshold',
        pointsCalculatorParams: {},
      });

      expect(result.home_games_won).toBe(2);
      expect(result.away_games_won).toBe(1);
    });
  });

  describe('linear_above_threshold (aggregate)', () => {
    it('above-win-band: 11 wins with games_to_win=10 → +1', () => {
      const games = Array.from({ length: 11 }, () => regularGame(HOME))
        .concat(Array.from({ length: 7 }, () => regularGame(AWAY)));

      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games,
        pointsCalculator: 'linear_above_threshold',
        pointsCalculatorParams: {},
      });

      expect(result.home_games_won).toBe(11);
      expect(result.away_games_won).toBe(7);
      expect(result.home_points_earned).toBe(1);
    });

    it('LOCKED tie-band rule: 9 wins of 18 with games_to_tie=9 → 0', () => {
      const games = Array.from({ length: 9 }, () => regularGame(HOME))
        .concat(Array.from({ length: 9 }, () => regularGame(AWAY)));

      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games,
        pointsCalculator: 'linear_above_threshold',
        pointsCalculatorParams: {},
      });

      expect(result.home_games_won).toBe(9);
      expect(result.away_games_won).toBe(9);
      expect(result.home_points_earned).toBe(0);
      expect(result.away_points_earned).toBe(0);
    });

    it('LOCKED tie-band with tiebreaker: 9-9 regular + away wins tiebreaker → both teams still 0 points', () => {
      // Anti-regression on the calculator-internal rule from the v2 plan
      // supplement Section 4: tiebreaker games never push a team out of
      // the tie band. Whoever wins the tiebreaker takes the match (handled
      // outside this helper — match completion writes winner_team_id) but
      // the running points totals stay at 0 / 0 because the calculator
      // sees only regular-game counts (9 / 9, both inside tie band).
      const games = Array.from({ length: 9 }, () => regularGame(HOME))
        .concat(Array.from({ length: 9 }, () => regularGame(AWAY)))
        .concat([tiebreakerGame(AWAY), tiebreakerGame(AWAY)]);

      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games,
        pointsCalculator: 'linear_above_threshold',
        pointsCalculatorParams: {},
      });

      expect(result.home_games_won).toBe(9);
      expect(result.away_games_won).toBe(9);
      expect(result.home_points_earned).toBe(0);
      expect(result.away_points_earned).toBe(0);
    });

    it('below-tie-band: 7 wins with games_to_tie=9 → -2', () => {
      const games = Array.from({ length: 7 }, () => regularGame(HOME))
        .concat(Array.from({ length: 11 }, () => regularGame(AWAY)));

      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games,
        pointsCalculator: 'linear_above_threshold',
        pointsCalculatorParams: {},
      });

      expect(result.home_points_earned).toBe(-2);
      expect(result.away_points_earned).toBe(1);
    });
  });

  describe('accumulated_per_game (per-game)', () => {
    it('Fargo 10-7: each home win contributes 10 + each away loss contributes balls pocketed', () => {
      const games: MinimalMatchGame[] = [
        regularGame(HOME, 3),
        regularGame(HOME, 5),
        regularGame(AWAY, 2),
      ];

      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games,
        pointsCalculator: 'accumulated_per_game',
        pointsCalculatorParams: {},
      });

      expect(result.home_games_won).toBe(2);
      expect(result.away_games_won).toBe(1);
      expect(result.home_points_earned).toBe(20 + 2);
      expect(result.away_points_earned).toBe(10 + 3 + 5);
    });
  });

  describe('null calculator', () => {
    it('returns zero points when points_calculator is null (game counts still update)', () => {
      const games = [regularGame(HOME), regularGame(HOME), regularGame(AWAY)];

      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games,
        pointsCalculator: null,
        pointsCalculatorParams: {},
      });

      expect(result.home_games_won).toBe(2);
      expect(result.away_games_won).toBe(1);
      expect(result.home_points_earned).toBe(0);
      expect(result.away_points_earned).toBe(0);
    });
  });

  describe('unknown calculator', () => {
    it('warns and returns zero points; game counts still update', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const games = [regularGame(HOME), regularGame(AWAY)];

      const result = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: HOME_THRESHOLDS,
        awayThresholds: AWAY_THRESHOLDS,
        games,
        pointsCalculator: 'experimental_calc_not_registered',
        pointsCalculatorParams: {},
      });

      expect(result.home_games_won).toBe(1);
      expect(result.away_games_won).toBe(1);
      expect(result.home_points_earned).toBe(0);
      expect(result.away_points_earned).toBe(0);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
