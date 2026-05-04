/**
 * @fileoverview Characterization tests for calculateFargoMatchTotals.
 *
 * `calculateFargoMatchTotals` is the function that produces the running
 * Fargo 5v5 scoreboard mid-match AND the final scoreboard at completion.
 * It bridges stored match_games rows to the fargo5v5 SystemModule's
 * `computeMatchResult`, applying the start-points credit and filtering
 * unconfirmed/unscored games out.
 *
 * This is precisely the function the user has flagged as the highest
 * stakes for E2E intermediate-state coverage: "make sure the numbers
 * match as each game is being recorded." The tests here lock the
 * running-totals math at the unit level so any refactor that changes
 * the visible scoreboard mid-match is caught.
 *
 * Why this is Phase 0b/c characterization rather than Unit 5.x: the
 * function calls `fargo5v5.scoring.computeMatchResult` (already locked
 * by `src/systems/__tests__/fargo5v5.test.ts`), so the test value here
 * is in the BRIDGE: confirmation gating, winner-team-id mapping, and
 * the start-points-from-threshold-columns convention.
 */

import { describe, it, expect } from 'vitest';
import { calculateFargoMatchTotals } from '../fargoMatchTotals';
import type { MatchGame } from '@/types/match';

const HOME = 'home-team-id';
const AWAY = 'away-team-id';

function game(overrides: Partial<MatchGame>): MatchGame {
  return {
    id: 'g',
    game_number: 1,
    home_position: 1,
    away_position: 1,
    home_player_id: null,
    away_player_id: null,
    winner_team_id: null,
    winner_player_id: null,
    home_action: 'breaks',
    away_action: 'racks',
    break_and_run: false,
    golden_break: false,
    confirmed_by_home: true,
    confirmed_by_away: true,
    is_tiebreaker: false,
    break_fouled: false,
    runout: false,
    win_by_forfeit: false,
    loser_balls_pocketed: null,
    ...overrides,
  };
}

describe('calculateFargoMatchTotals — characterization (running scoreboard)', () => {
  describe('empty / unscored states', () => {
    it('returns all zeros when no games are present', () => {
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: [],
        overrides: {},
      });
      expect(result.homePoints).toBe(0);
      expect(result.awayPoints).toBe(0);
      expect(result.homeGamesWon).toBe(0);
      expect(result.awayGamesWon).toBe(0);
      expect(result.startPointsApplied).toBe(0);
      expect(result.startPointsFor).toBe('even');
    });

    it('treats null homeGamesToWin / awayGamesToWin as zero (no credit)', () => {
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: null,
        awayGamesToWin: null,
        gameResults: [],
        overrides: {},
      });
      expect(result.startPointsApplied).toBe(0);
      expect(result.startPointsFor).toBe('even');
    });
  });

  describe('confirmation gating (only fully-confirmed games count)', () => {
    it('skips games where winner_team_id is null (unscored)', () => {
      const games = [
        game({ id: 'g1', game_number: 1, winner_team_id: null }),
        game({
          id: 'g2',
          game_number: 2,
          winner_team_id: HOME,
          loser_balls_pocketed: 3,
        }),
      ];
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: {},
      });
      expect(result.homeGamesWon).toBe(1);
      expect(result.awayGamesWon).toBe(0);
    });

    it('skips games where confirmed_by_home is false', () => {
      const games = [
        game({
          id: 'g1',
          game_number: 1,
          winner_team_id: HOME,
          loser_balls_pocketed: 3,
          confirmed_by_home: false,
          confirmed_by_away: true,
        }),
        game({
          id: 'g2',
          game_number: 2,
          winner_team_id: HOME,
          loser_balls_pocketed: 3,
        }),
      ];
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: {},
      });
      expect(result.homeGamesWon).toBe(1);
    });

    it('skips games where confirmed_by_away is false', () => {
      const games = [
        game({
          id: 'g1',
          game_number: 1,
          winner_team_id: HOME,
          loser_balls_pocketed: 3,
          confirmed_by_home: true,
          confirmed_by_away: false,
        }),
        game({
          id: 'g2',
          game_number: 2,
          winner_team_id: HOME,
          loser_balls_pocketed: 3,
        }),
      ];
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: {},
      });
      expect(result.homeGamesWon).toBe(1);
    });
  });

  describe('winner-team-id → home/away mapping', () => {
    it('maps winner_team_id === homeTeamId to home win', () => {
      const games = [
        game({ winner_team_id: HOME, loser_balls_pocketed: 0 }),
      ];
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: {},
      });
      expect(result.homeGamesWon).toBe(1);
      expect(result.awayGamesWon).toBe(0);
    });

    it('maps winner_team_id === awayTeamId to away win', () => {
      const games = [
        game({ winner_team_id: AWAY, loser_balls_pocketed: 0 }),
      ];
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: {},
      });
      expect(result.homeGamesWon).toBe(0);
      expect(result.awayGamesWon).toBe(1);
    });

    it('defensively maps unknown winner_team_id to home (should never happen in practice)', () => {
      // This is the file's own defensive fallback; the test locks it so a
      // refactor doesn't accidentally change the fallback direction.
      const games = [
        game({ winner_team_id: 'someone-else', loser_balls_pocketed: 0 }),
      ];
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: {},
      });
      expect(result.homeGamesWon).toBe(1);
      expect(result.awayGamesWon).toBe(0);
    });
  });

  describe('start-points credit application (the negotiated handicap)', () => {
    it('home > 0 → start points credited to home', () => {
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 56,
        awayGamesToWin: 0,
        gameResults: [],
        overrides: {},
      });
      expect(result.startPointsApplied).toBe(56);
      expect(result.startPointsFor).toBe('home');
      // Home gets 56 points from the credit alone
      expect(result.homePoints).toBe(56);
      expect(result.awayPoints).toBe(0);
    });

    it('away > 0 → start points credited to away', () => {
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 42,
        gameResults: [],
        overrides: {},
      });
      expect(result.startPointsApplied).toBe(42);
      expect(result.startPointsFor).toBe('away');
      expect(result.homePoints).toBe(0);
      expect(result.awayPoints).toBe(42);
    });

    it('both zero → no credit applied, weakerTeam = "even"', () => {
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: [],
        overrides: {},
      });
      expect(result.startPointsApplied).toBe(0);
      expect(result.startPointsFor).toBe('even');
    });
  });

  describe('running totals — partial scoring (mid-match scoreboard)', () => {
    it('after 3 games (2 home wins, 1 away win), totals reflect played games only', () => {
      const games = [
        game({ id: 'g1', game_number: 1, winner_team_id: HOME, loser_balls_pocketed: 3 }),
        game({ id: 'g2', game_number: 2, winner_team_id: HOME, loser_balls_pocketed: 5 }),
        game({ id: 'g3', game_number: 3, winner_team_id: AWAY, loser_balls_pocketed: 2 }),
        // Game 4 unscored
        game({ id: 'g4', game_number: 4, winner_team_id: null }),
      ];
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: {},
      });
      // Default winner_points=10, loser_points=balls_pocketed
      // Home wins g1+g2: home gets 10+10=20, away gets 3+5=8
      // Away wins g3: away gets 10, home gets 2
      // Final: home 22 (20+2), away 18 (8+10)
      expect(result.homeGamesWon).toBe(2);
      expect(result.awayGamesWon).toBe(1);
      expect(result.homePoints).toBe(22);
      expect(result.awayPoints).toBe(18);
    });

    it('start-points credit is added on TOP of game-derived points', () => {
      const games = [
        game({ id: 'g1', game_number: 1, winner_team_id: HOME, loser_balls_pocketed: 0 }),
      ];
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 56,
        gameResults: games,
        overrides: {},
      });
      // Home wins one: home gets 10, away gets 0
      // Plus 56 credit to away → away total = 56
      expect(result.homePoints).toBe(10);
      expect(result.awayPoints).toBe(56);
      expect(result.homeGamesWon).toBe(1);
    });
  });

  describe('Map vs Array input', () => {
    it('accepts a Map<number, MatchGame> with the same result as an array', () => {
      const arr = [
        game({ id: 'g1', game_number: 1, winner_team_id: HOME, loser_balls_pocketed: 3 }),
        game({ id: 'g2', game_number: 2, winner_team_id: AWAY, loser_balls_pocketed: 5 }),
      ];
      const map = new Map<number, MatchGame>([
        [1, arr[0]],
        [2, arr[1]],
      ]);
      const args = {
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        overrides: {},
      };
      const fromArr = calculateFargoMatchTotals({ ...args, gameResults: arr });
      const fromMap = calculateFargoMatchTotals({ ...args, gameResults: map });
      expect(fromArr).toEqual(fromMap);
    });
  });

  describe('overrides plumb through to fargo5v5 scoring', () => {
    it('winner_points override changes per-game points awarded', () => {
      const games = [
        game({ id: 'g1', game_number: 1, winner_team_id: HOME, loser_balls_pocketed: 3 }),
      ];
      const def = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: {},
      });
      // Default winner_points=10
      expect(def.homePoints).toBe(10);

      const overridden = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: { winner_points: 14 },
      });
      // winner_points=14
      expect(overridden.homePoints).toBe(14);
    });

    it('undefined overrides treated as empty object', () => {
      const games = [
        game({ id: 'g1', game_number: 1, winner_team_id: HOME, loser_balls_pocketed: 3 }),
      ];
      const result = calculateFargoMatchTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGamesToWin: 0,
        awayGamesToWin: 0,
        gameResults: games,
        overrides: undefined,
      });
      // Same as empty overrides — defaults applied
      expect(result.homePoints).toBe(10);
    });
  });
});
