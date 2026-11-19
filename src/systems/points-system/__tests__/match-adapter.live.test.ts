/**
 * @fileoverview Live-path rules in the points engine adapter that the parity
 * tests can't see (found by the mutation run, U8). The parity tests always
 * hand both paths saved targets that equal the chart, so "used the saved
 * targets" and "used the chart" look the same there.
 *
 * Rules guarded here, for the real league's setup (3-man, points handicap,
 * linear_above_threshold):
 *   1. A match with no saved targets scores against the handicap chart.
 *   2. A game counts only for the team that won it. A winner that is neither
 *      team (bad data) counts for nobody.
 *
 * Expected numbers come from the BCA 3-man chart: a +4 handicap diff needs
 * 12 to win / 11 to tie; −4 needs 8 / 7. Points = games won − tie target.
 *
 * @see ../match-adapter.ts
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U8)
 */

import { describe, it, expect } from 'vitest';
import { computeMatchRunningTotalsViaEngine, type MinimalMatchGame } from '../match-adapter';

const HOME = 'HOME';
const AWAY = 'AWAY';
const NO_TARGETS = { games_to_win: null, games_to_tie: null, games_to_lose: null };

const won = (winner_team_id: string | null): MinimalMatchGame => ({
  winner_team_id,
  winner_value: null,
  loser_value: null,
  is_tiebreaker: false,
  confirmed_by_home: 'h-confirmer',
  confirmed_by_away: 'a-confirmer',
});
const games = (home: number, away: number) => [
  ...Array.from({ length: home }, () => won(HOME)),
  ...Array.from({ length: away }, () => won(AWAY)),
];

const run = (matchGames: MinimalMatchGame[], homeDiff: number) =>
  computeMatchRunningTotalsViaEngine({
    homeTeamId: HOME,
    awayTeamId: AWAY,
    games: matchGames,
    pointsCalculator: 'linear_above_threshold',
    pointsCalculatorParams: {},
    winCondition: 'games',
    thresholdInputs: {
      homeRatings: [],
      awayRatings: [],
      homeHandicapDiff: homeDiff,
      awayHandicapDiff: -homeDiff,
      gameCount: 18,
      prefs: {},
    },
    homeThresholds: NO_TARGETS,
    awayThresholds: NO_TARGETS,
  });

describe('a match with no saved targets scores against the chart', () => {
  it('home +4 wins 14–4 → +3 / −3 (14 − 11, 4 − 7)', () => {
    expect(run(games(14, 4), 4)).toEqual({
      home_games_won: 14, away_games_won: 4, home_points_earned: 3, away_points_earned: -3,
    });
  });
});

describe('a game counts only for the team that won it', () => {
  it('a winner that is neither team counts for nobody', () => {
    const result = run([...games(11, 7), won('SOME-OTHER-TEAM')], 0);
    expect(result.home_games_won).toBe(11);
    expect(result.away_games_won).toBe(7);
  });
});
