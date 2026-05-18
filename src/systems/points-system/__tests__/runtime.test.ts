/**
 * @fileoverview Tests for the Points System runtime evaluator.
 *
 * End-to-end tests that walk a complete PointsSystem composition over a
 * sequence of games and verify the final per-side points + variables.
 *
 * Uses minimal hand-built compositions per test case (the 3 prepackaged
 * Scoring System compositions land in a later slice; this file tests the
 * runtime mechanics).
 *
 * @see ../runtime.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { evaluatePointsSystem, type RuntimeGameRecord } from '../runtime';
import { linearAboveThresholdAggregate } from '../aggregate';
import {
  computedThreshold,
  constantThreshold,
  prefThreshold,
} from '../threshold-helpers';
import type { PointsSystem, ThresholdInputs } from '../types';

const emptyInputs: ThresholdInputs = {
  homeRatings: [],
  awayRatings: [],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 0,
  prefs: {},
};

function homeWins(): RuntimeGameRecord {
  return { winnerSide: 'home', winnerCounterInput: null, loserCounterInput: null };
}
function awayWins(): RuntimeGameRecord {
  return { winnerSide: 'away', winnerCounterInput: null, loserCounterInput: null };
}

describe('evaluatePointsSystem — wins counting (no allocator, no triggers)', () => {
  const composition: PointsSystem = {
    name: 'just_wins',
    thresholds: {},
    triggers: [],
  };

  it('counts home_wins and away_wins correctly', () => {
    const games = [homeWins(), homeWins(), awayWins(), homeWins()];
    const state = evaluatePointsSystem(composition, emptyInputs, games);
    expect(state.home_wins).toBe(3);
    expect(state.away_wins).toBe(1);
  });

  it('initializes per-side variables to 0 even with no games', () => {
    const state = evaluatePointsSystem(composition, emptyInputs, []);
    expect(state.home_wins).toBe(0);
    expect(state.away_wins).toBe(0);
    expect(state.home_points).toBe(0);
    expect(state.away_points).toBe(0);
  });
});

describe('evaluatePointsSystem — Percentage 5-Man-style accumulation (allocator + milestone triggers)', () => {
  // Per-game allocator: winner=0.1 fixed, loser=0 fixed
  // Threshold: milestoneTarget = round(games_to_win × 0.7), milestoneValue = 1.5
  // Trigger: when home_wins reaches milestoneTarget → jump home_points to 1.5
  // Trigger: when away_wins reaches milestoneTarget → jump away_points to 1.5
  // (No second milestone for simplicity; one milestone is enough to verify the mechanism)
  const composition: PointsSystem = {
    name: 'percent_milestone_test',
    thresholds: {
      milestoneTarget: computedThreshold('milestoneTarget', (inputs) =>
        Math.round(
          (inputs.prefs.games_to_win as number) *
            (inputs.prefs.milestone_percent as number),
        ),
      ),
    },
    perGameAllocator: {
      name: 'percent_allocator',
      winner: { kind: 'fixed', points: 0.1 },
      loser: { kind: 'fixed', points: 0 },
    },
    triggers: [
      {
        name: 'home_milestone',
        when: {
          kind: 'side_reaches',
          thresholdRef: 'milestoneTarget',
          side: 'any',
          sideVarTemplate: '<side>_wins',
        },
        action: {
          target: { kind: 'side_scoped', variableNameTemplate: '<side>_points' },
          op: 'assign',
          value: { kind: 'literal', value: 1.5 },
        },
      },
    ],
  };

  const inputs: ThresholdInputs = {
    ...emptyInputs,
    prefs: { games_to_win: 13, milestone_percent: 0.7 }, // milestoneTarget = 9
  };

  it('linear accumulation below milestone', () => {
    // 8 home wins, 0 away
    const games = Array.from({ length: 8 }, homeWins);
    const state = evaluatePointsSystem(composition, inputs, games);
    expect(state.home_wins).toBe(8);
    expect(state.home_points).toBeCloseTo(0.8); // 8 × 0.1
  });

  it('milestone fires at game 9 → replaces accumulated total with 1.5', () => {
    const games = Array.from({ length: 9 }, homeWins);
    const state = evaluatePointsSystem(composition, inputs, games);
    expect(state.home_wins).toBe(9);
    expect(state.home_points).toBe(1.5); // jumped from 0.9 to 1.5
  });

  it('post-milestone games accumulate on top of the jumped value', () => {
    const games = Array.from({ length: 12 }, homeWins);
    const state = evaluatePointsSystem(composition, inputs, games);
    expect(state.home_wins).toBe(12);
    // 1.5 (jumped at game 9) + 3 × 0.1 (games 10, 11, 12) = 1.8
    expect(state.home_points).toBeCloseTo(1.8);
  });

  it('milestone fires independently for each side', () => {
    // 9 wins each
    const games = [
      ...Array.from({ length: 9 }, homeWins),
      ...Array.from({ length: 9 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, inputs, games);
    expect(state.home_points).toBe(1.5);
    expect(state.away_points).toBe(1.5);
  });
});

describe('evaluatePointsSystem — receipt-trigger initial points (FargoRate start_points pattern)', () => {
  // Threshold computes "initial points to award to home" (fixed at 56 for this test)
  // Trigger: when receipt, add the threshold value to home_points
  const composition: PointsSystem = {
    name: 'fargo_initial',
    thresholds: {
      initialHome: constantThreshold('initialHome', 0),
      initialAway: constantThreshold('initialAway', 56),
    },
    triggers: [
      {
        name: 'award_initial_home',
        when: { kind: 'receipt', thresholdRef: 'initialHome' },
        action: {
          target: { kind: 'concrete', variableName: 'home_points' },
          op: 'add',
          value: { kind: 'threshold_ref', thresholdRef: 'initialHome' },
        },
      },
      {
        name: 'award_initial_away',
        when: { kind: 'receipt', thresholdRef: 'initialAway' },
        action: {
          target: { kind: 'concrete', variableName: 'away_points' },
          op: 'add',
          value: { kind: 'threshold_ref', thresholdRef: 'initialAway' },
        },
      },
    ],
  };

  it('awards initial points at match start before any games', () => {
    const state = evaluatePointsSystem(composition, emptyInputs, []);
    expect(state.home_points).toBe(0);
    expect(state.away_points).toBe(56);
  });

  it('initial points persist as games are played (no per-game allocator here)', () => {
    const games = [homeWins(), homeWins()];
    const state = evaluatePointsSystem(composition, emptyInputs, games);
    expect(state.home_points).toBe(0);
    expect(state.away_points).toBe(56);
  });
});

describe('evaluatePointsSystem — end-of-match aggregate (Points 3-Man pattern with tie-band)', () => {
  // Receipt triggers assign chart values (homeWinTarget, homeTieTarget, etc.) to variables
  // End-of-match aggregate reads those variables and applies linear_above_threshold formula
  const composition: PointsSystem = {
    name: 'points_3man_test',
    thresholds: {
      homeWinTarget: computedThreshold('homeWinTarget', () => 10),
      awayWinTarget: computedThreshold('awayWinTarget', () => 10),
      homeTieTarget: computedThreshold('homeTieTarget', () => 9),
      awayTieTarget: computedThreshold('awayTieTarget', () => 9),
      homeLoseTarget: computedThreshold('homeLoseTarget', () => 8),
      awayLoseTarget: computedThreshold('awayLoseTarget', () => 8),
    },
    triggers: [
      ...(
        [
          'homeWinTarget',
          'awayWinTarget',
          'homeTieTarget',
          'awayTieTarget',
          'homeLoseTarget',
          'awayLoseTarget',
        ] as const
      ).map((name) => ({
        name: `assign_${name}`,
        when: { kind: 'receipt' as const, thresholdRef: name },
        action: {
          target: { kind: 'concrete' as const, variableName: name },
          op: 'assign' as const,
          value: { kind: 'threshold_ref' as const, thresholdRef: name },
        },
      })),
    ],
    endOfMatchAggregate: linearAboveThresholdAggregate({ multiplier: 1 }),
  };

  it('home wins 12-6 → home_points=2 (above-win band)', () => {
    const games = [
      ...Array.from({ length: 12 }, homeWins),
      ...Array.from({ length: 6 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, emptyInputs, games);
    expect(state.home_points).toBe(2); // (12-10)*1
    expect(state.away_points).toBe(-3); // (6-9)*1 → below-tie band
  });

  it('9-9 tie → BOTH sides get 0 (tie-band absorbs)', () => {
    const games = [
      ...Array.from({ length: 9 }, homeWins),
      ...Array.from({ length: 9 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, emptyInputs, games);
    expect(state.home_points).toBe(0);
    expect(state.away_points).toBe(0);
  });

  it('10-8 outcome → home_points=0 (tie-band), away_points=-1 (below-tie)', () => {
    const games = [
      ...Array.from({ length: 10 }, homeWins),
      ...Array.from({ length: 8 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, emptyInputs, games);
    expect(state.home_points).toBe(0); // tie band absorbs
    expect(state.away_points).toBe(-1); // (8-9)*1
  });
});

describe('evaluatePointsSystem — win-chip signal pattern', () => {
  const composition: PointsSystem = {
    name: 'win_chip_test',
    thresholds: {
      winTarget: constantThreshold('winTarget', 10),
    },
    triggers: [
      {
        name: 'set_win_chip',
        when: {
          kind: 'side_reaches',
          thresholdRef: 'winTarget',
          side: 'any',
          sideVarTemplate: '<side>_wins',
        },
        action: {
          target: { kind: 'concrete', variableName: 'win_chip' },
          op: 'assign',
          value: { kind: 'triggering_side' },
        },
      },
    ],
  };

  it('home reaches 10 wins first → win_chip becomes "home"', () => {
    const games = [
      ...Array.from({ length: 10 }, homeWins),
      ...Array.from({ length: 7 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, emptyInputs, games);
    expect(state.win_chip).toBe('home');
  });

  it('away reaches 10 wins first → win_chip becomes "away"', () => {
    const games = [
      ...Array.from({ length: 10 }, awayWins),
      ...Array.from({ length: 7 }, homeWins),
    ];
    const state = evaluatePointsSystem(composition, emptyInputs, games);
    expect(state.win_chip).toBe('away');
  });

  it('neither side reaches 10 → win_chip never set (tie via absence of chip)', () => {
    const games = [
      ...Array.from({ length: 9 }, homeWins),
      ...Array.from({ length: 9 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, emptyInputs, games);
    expect(state.win_chip).toBeUndefined();
  });
});
