/**
 * @fileoverview Tests for the 17-Point Scoring System composition.
 *
 * 17-Point is a zero-sum format: each game distributes exactly 17 points.
 * Winner = 10 + (7 - loser_balls); loser = loser_balls. Plus FargoRate
 * start-points awarded to the weaker team at match start.
 *
 * No legacy calculator exists for 17-Point (we don't run it today), so these
 * are direct behavioral tests rather than a cross-audit.
 *
 * @see ../compositions/17-point.ts — composition under test
 */

import { describe, it, expect } from 'vitest';
import { evaluatePointsSystem, type RuntimeGameRecord } from '../runtime';
import { buildSeventeenPointComposition } from '../compositions/17-point';
import type { ThresholdInputs } from '../types';

const equalLineupInputs: ThresholdInputs = {
  // Equal ratings → no start-points to either side (weakerTeam = 'even').
  homeRatings: [500, 500, 500, 500, 500],
  awayRatings: [500, 500, 500, 500, 500],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 25,
  prefs: {},
};

function game(winnerSide: 'home' | 'away', loserBalls: number): RuntimeGameRecord {
  return { winnerSide, winnerCounterInput: null, loserCounterInput: loserBalls };
}

describe('17-Point composition — zero-sum per-game split', () => {
  it('each game distributes exactly 17 points between the sides', () => {
    const composition = buildSeventeenPointComposition();
    // One home win where loser pockets 3: home gets 14, away gets 3.
    const state = evaluatePointsSystem(composition, equalLineupInputs, [game('home', 3)]);
    expect(state.home_points).toBe(14);
    expect(state.away_points).toBe(3);
    expect((state.home_points as number) + (state.away_points as number)).toBe(17);
  });

  it.each([
    { balls: 0, winnerPts: 17, loserPts: 0 },
    { balls: 3, winnerPts: 14, loserPts: 3 },
    { balls: 7, winnerPts: 10, loserPts: 7 },
  ])('loser pockets $balls → winner +$winnerPts, loser +$loserPts', ({ balls, winnerPts, loserPts }) => {
    const composition = buildSeventeenPointComposition();
    const state = evaluatePointsSystem(composition, equalLineupInputs, [game('home', balls)]);
    expect(state.home_points).toBe(winnerPts);
    expect(state.away_points).toBe(loserPts);
  });

  it('accumulates across multiple games (always 17 per game total)', () => {
    const composition = buildSeventeenPointComposition();
    const games = [game('home', 2), game('away', 5), game('home', 0)];
    const state = evaluatePointsSystem(composition, equalLineupInputs, games);
    // Game 1: home +15, away +2
    // Game 2: away +12, home +5
    // Game 3: home +17, away +0
    // home = 15 + 5 + 17 = 37 ; away = 2 + 12 + 0 = 14 ; total = 51 = 3×17
    expect(state.home_points).toBe(37);
    expect(state.away_points).toBe(14);
    expect((state.home_points as number) + (state.away_points as number)).toBe(51);
  });
});

describe('17-Point composition — FargoRate start-points layered on top', () => {
  it('weaker team gets start-points head-start at match start', () => {
    // Real-match anchor ratings (per docs/research/fargorate-formula.md):
    // home strong, away weak → 56 start points to away.
    const composition = buildSeventeenPointComposition();
    const inputs: ThresholdInputs = {
      homeRatings: [567, 458, 493, 486, 574],
      awayRatings: [447, 394, 452, 322, 374],
      homeHandicapDiff: 0,
      awayHandicapDiff: 0,
      gameCount: 25,
      prefs: {},
    };
    // Empty match — only start-points applied.
    const state = evaluatePointsSystem(composition, inputs, []);
    expect(state.home_points).toBe(0); // stronger team, no head-start
    expect(state.away_points).toBe(56); // weaker team gets the head-start
  });
});
