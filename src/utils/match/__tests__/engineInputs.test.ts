/**
 * @fileoverview The pure middle of the engine scoring path (engineInputs.ts):
 * locked lineups + games in, running totals out.
 *
 * Expected values come from the league rule, not from running the code:
 * `linear_above_threshold` scores games won minus par (`games_to_tie`), so a
 * 10–8 night with par 9 is +1 / −1 (the rule pinned by the 2026 standings
 * points fix, memory-bank/plans/PLAN-standings-points-fix.md).
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U2)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildThresholdInputs, computeEngineTotalsFromLineups, type LineupRow } from '../engineInputs';
import type { EngineRunningTotalsArgs } from '../engineRunningTotals';
import type { MinimalMatchGame } from '../computeMatchRunningTotals';
import { registerTestedPresetCalculators, clearRegistry } from '@/systems/calculators';

const HOME = 'home-team';
const AWAY = 'away-team';

/** A 3-player lineup; `modifier` is the frozen team bonus (home side only). */
function lineup(team: string, handicaps: number[], modifier: number | null = null): LineupRow {
  const [player1_handicap = null, player2_handicap = null, player3_handicap = null] = handicaps;
  return { team_id: team, player1_handicap, player2_handicap, player3_handicap, player4_handicap: null, player5_handicap: null, home_team_modifier: modifier };
}

/** `homeWins` + `awayWins` confirmed regular games. */
function games(homeWins: number, awayWins: number): MinimalMatchGame[] {
  const game = (winner: string): MinimalMatchGame => ({
    winner_team_id: winner, winner_value: null, loser_value: null, is_tiebreaker: false,
    confirmed_by_home: 'h', confirmed_by_away: 'a',
  });
  return [...Array(homeWins).fill(HOME).map(game), ...Array(awayWins).fill(AWAY).map(game)];
}

const PAR_9 = { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 };

function args(g: MinimalMatchGame[]): EngineRunningTotalsArgs {
  return {
    matchId: 'm1', homeTeamId: HOME, awayTeamId: AWAY,
    homeThresholds: PAR_9, awayThresholds: PAR_9, games: g,
    pointsCalculator: 'linear_above_threshold', pointsCalculatorParams: {},
    winCondition: 'games', perGameAllocatorOverride: null,
  };
}

beforeEach(() => { clearRegistry(); registerTestedPresetCalculators(); });
afterEach(() => clearRegistry());

describe('computeEngineTotalsFromLineups', () => {
  it('scores a 10–8 night at par 9 as +1 / −1', () => {
    const lineups = [lineup(HOME, [2, 1, 0], 1), lineup(AWAY, [1, 1, 1])];
    expect(computeEngineTotalsFromLineups(args(games(10, 8)), lineups)).toEqual({
      home_games_won: 10, away_games_won: 8, home_points_earned: 1, away_points_earned: -1,
    });
  });

  // Also the guard on matching lineups by TEAM: a by-position lookup would
  // happily return the 'other' team's lineup instead of null.
  it('returns null (caller falls back to legacy) without both lineups', () => {
    expect(computeEngineTotalsFromLineups(args(games(10, 8)), [lineup(HOME, [1])])).toBeNull();
    expect(computeEngineTotalsFromLineups(args(games(10, 8)), [lineup(HOME, [1]), lineup('other', [1])])).toBeNull();
  });
});

describe('buildThresholdInputs', () => {
  it('adds the frozen team bonus to the home side only', () => {
    const inputs = buildThresholdInputs(lineup(HOME, [2, 1, 0], 1), lineup(AWAY, [1, 1, 1]), 18);
    expect(inputs).toMatchObject({ homeTeamHandicap: 4, awayTeamHandicap: 3, homeHandicapDiff: 1, awayHandicapDiff: -1, gameCount: 18 });
  });

  it('playoffs: team bonus is 0, but the players’ own handicaps still count', () => {
    const inputs = buildThresholdInputs(lineup(HOME, [2, 1, 0], 0), lineup(AWAY, [-1, 0, 0]), 18);
    expect(inputs).toMatchObject({ homeTeamHandicap: 3, awayTeamHandicap: -1, homeHandicapDiff: 4 });
    expect(inputs.homeRatings).toEqual([2, 1, 0]);
  });

  it('skips empty seats instead of counting them as 0-rated players', () => {
    expect(buildThresholdInputs(lineup(HOME, [3]), lineup(AWAY, [1, 1]), 18).homeRatings).toEqual([3]);
  });
});
