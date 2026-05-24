/**
 * @fileoverview Tests for the illustrative behind-boost handicap composition.
 *
 * Verifies the per-game allocator can read MULTIPLE state variables in one
 * formula end-to-end through the runtime. The behind-boost formula gives the
 * home winner `(total_games - home_wins) * 0.5` per game won — more points
 * when home is further behind.
 *
 * @see ../compositions/behind-boost-handicap.ts — composition under test
 */

import { describe, it, expect } from 'vitest';
import { evaluatePointsSystem, type RuntimeGameRecord } from '../runtime';
import { buildBehindBoostExample } from '../compositions/behind-boost-handicap';
import type { ThresholdInputs } from '../types';

const inputs: ThresholdInputs = {
  homeRatings: [],
  awayRatings: [],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 25, // total_games = 25
  prefs: {},
};

function homeWins(): RuntimeGameRecord {
  return { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null };
}
function awayWins(): RuntimeGameRecord {
  return { winnerSide: 'away', winnerCounterInput: null, loserCounterInput: null };
}

describe('behind-boost composition — formula reads total_games + home_wins', () => {
  it('first home win: home_wins=1 after increment → (25-1)*0.5 = 12', () => {
    // The formula runs AFTER the win increment, so home_wins=1 on the first win.
    const state = evaluatePointsSystem(buildBehindBoostExample(), inputs, [homeWins()]);
    expect(state.home_wins).toBe(1);
    expect(state.home_points).toBe(12); // (25 - 1) * 0.5
  });

  it('per-game value shrinks as home accumulates wins (catch-up shrinks)', () => {
    // Win 1: (25-1)*0.5 = 12
    // Win 2: (25-2)*0.5 = 11.5
    // Win 3: (25-3)*0.5 = 11
    // total after 3 home wins = 12 + 11.5 + 11 = 34.5
    const games = [homeWins(), homeWins(), homeWins()];
    const state = evaluatePointsSystem(buildBehindBoostExample(), inputs, games);
    expect(state.home_wins).toBe(3);
    expect(state.home_points).toBeCloseTo(34.5);
  });

  it('away wins do not change home_wins → home boost unaffected by away games', () => {
    // away win doesn't increment home_wins; the winner side here is away, and
    // the winner formula reads home_wins regardless of who won — illustrating
    // the formula reads STATE, not the per-game winner.
    // Game 1 (away wins): formula computes for away winner → (25 - 0)*0.5 = 12.5
    //   (home_wins still 0 because away won)
    const state = evaluatePointsSystem(buildBehindBoostExample(), inputs, [awayWins()]);
    expect(state.away_wins).toBe(1);
    expect(state.home_wins).toBe(0);
    expect(state.away_points).toBe(12.5); // (25 - 0) * 0.5 — home_wins=0
  });
});
