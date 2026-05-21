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
// Side-effect import: register the linear_above_threshold aggregate operation.
import '../aggregate-operations/linear-above-threshold';
import { buildThresholdRow } from '../threshold-resolver';
// Side-effect imports: register the operations these tests reference.
import '../operations/read-pref';
import '../operations/arithmetic-round-product';
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
  // Threshold: milestoneTarget = round(games_to_win × 0.7) = 9
  // Triggers (new model — anytime, after-allocator, single_shot):
  //   - homeMilestone: when home_wins == milestoneTarget, set home_points = 1.5
  //                    (jump replaces running total; fires after the allocator
  //                    so it overwrites the per-game add for the clinching game)
  //   - awayMilestone: same shape for away
  const composition: PointsSystem = {
    name: 'percent_milestone_test',
    thresholds: {
      milestoneTarget: buildThresholdRow({
        name: 'milestoneTarget',
        operationKind: 'arithmetic_round_product',
        operationArgs: {
          factor_pref_keys: ['games_to_win', 'milestone_percent'],
        },
      }),
    },
    perGameAllocator: {
      name: 'percent_allocator',
      winner: { base: 0.1, formula: null },
      loser: { base: 0, formula: null },
    },
    triggers: [
      {
        name: 'homeMilestone',
        type: 'anytime',
        condition: {
          kind: 'compare',
          left: { kind: 'var', name: 'home_wins' },
          op: '==',
          right: { kind: 'var', name: 'milestoneTarget' },
        },
        action: { target: 'home_points', value: { kind: 'set', value: 1.5 } },
        rearm: 'single_shot',
        order: { number: 1, beforeAllocator: false },
      },
      {
        name: 'awayMilestone',
        type: 'anytime',
        condition: {
          kind: 'compare',
          left: { kind: 'var', name: 'away_wins' },
          op: '==',
          right: { kind: 'var', name: 'milestoneTarget' },
        },
        action: { target: 'away_points', value: { kind: 'set', value: 1.5 } },
        rearm: 'single_shot',
        order: { number: 2, beforeAllocator: false },
      },
    ],
  };

  const inputs: ThresholdInputs = {
    ...emptyInputs,
    prefs: { games_to_win: 13, milestone_percent: 0.7 }, // milestoneTarget = 9
  };

  it('linear accumulation below milestone', () => {
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
    const games = [
      ...Array.from({ length: 9 }, homeWins),
      ...Array.from({ length: 9 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, inputs, games);
    expect(state.home_points).toBe(1.5);
    expect(state.away_points).toBe(1.5);
  });
});

describe('evaluatePointsSystem — match_start-trigger initial points (FargoRate start_points pattern)', () => {
  // match_start triggers ADD a start-points threshold (already written to state
  // by name) to the per-side points variables at match start, via an `expr`
  // action (points = points + threshold). Threshold values come from prefs to
  // keep the test self-contained.
  const composition: PointsSystem = {
    name: 'fargo_initial',
    thresholds: {
      initialHome: buildThresholdRow({
        name: 'initialHome',
        operationKind: 'read_pref',
        operationArgs: { pref_key: 'test_initial_home' },
      }),
      initialAway: buildThresholdRow({
        name: 'initialAway',
        operationKind: 'read_pref',
        operationArgs: { pref_key: 'test_initial_away' },
      }),
    },
    triggers: [
      {
        name: 'award_initial_home',
        type: 'match_start',
        condition: { kind: 'always' },
        action: {
          target: 'home_points',
          value: {
            kind: 'expr',
            expr: {
              kind: 'op',
              op: '+',
              left: { kind: 'var', name: 'home_points' },
              right: { kind: 'var', name: 'initialHome' },
            },
          },
        },
        rearm: 'single_shot',
        order: { number: 1, beforeAllocator: false },
      },
      {
        name: 'award_initial_away',
        type: 'match_start',
        condition: { kind: 'always' },
        action: {
          target: 'away_points',
          value: {
            kind: 'expr',
            expr: {
              kind: 'op',
              op: '+',
              left: { kind: 'var', name: 'away_points' },
              right: { kind: 'var', name: 'initialAway' },
            },
          },
        },
        rearm: 'single_shot',
        order: { number: 2, beforeAllocator: false },
      },
    ],
  };

  const initialInputs: ThresholdInputs = {
    ...emptyInputs,
    prefs: { test_initial_home: 0, test_initial_away: 56 },
  };

  it('awards initial points at match start before any games', () => {
    const state = evaluatePointsSystem(composition, initialInputs, []);
    expect(state.home_points).toBe(0);
    expect(state.away_points).toBe(56);
  });

  it('initial points persist as games are played (no per-game allocator here)', () => {
    const games = [homeWins(), homeWins()];
    const state = evaluatePointsSystem(composition, initialInputs, games);
    expect(state.home_points).toBe(0);
    expect(state.away_points).toBe(56);
  });
});

describe('evaluatePointsSystem — end-of-match aggregate (Points 3-Man pattern with tie-band)', () => {
  // Thresholds are state setters: the runtime writes each resolved chart-target
  // value into the state bag under its name at match start, so the aggregate can
  // read them directly — no copy-trigger needed. End-of-match aggregate applies
  // the linear_above_threshold formula with the locked tie-band absorption rule.
  const TARGET_NAMES = [
    'homeWinTarget',
    'awayWinTarget',
    'homeTieTarget',
    'awayTieTarget',
    'homeLoseTarget',
    'awayLoseTarget',
  ] as const;

  const composition: PointsSystem = {
    name: 'points_3man_test',
    thresholds: Object.fromEntries(
      TARGET_NAMES.map((name) => [
        name,
        buildThresholdRow({
          name,
          operationKind: 'read_pref',
          operationArgs: { pref_key: `test_${name}` },
        }),
      ]),
    ),
    triggers: [],
    endOfMatchAggregate: {
      operationKind: 'linear_above_threshold',
      operationArgs: { multiplier: 1 },
    },
  };

  const aggregateInputs: ThresholdInputs = {
    ...emptyInputs,
    prefs: {
      test_homeWinTarget: 10,
      test_awayWinTarget: 10,
      test_homeTieTarget: 9,
      test_awayTieTarget: 9,
      test_homeLoseTarget: 8,
      test_awayLoseTarget: 8,
    },
  };

  it('home wins 12-6 → home_points=2 (above-win band)', () => {
    const games = [
      ...Array.from({ length: 12 }, homeWins),
      ...Array.from({ length: 6 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, aggregateInputs, games);
    expect(state.home_points).toBe(2); // (12-10)*1
    expect(state.away_points).toBe(-3); // (6-9)*1 → below-tie band
  });

  it('9-9 tie → BOTH sides get 0 (tie-band absorbs)', () => {
    const games = [
      ...Array.from({ length: 9 }, homeWins),
      ...Array.from({ length: 9 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, aggregateInputs, games);
    expect(state.home_points).toBe(0);
    expect(state.away_points).toBe(0);
  });

  it('10-8 outcome → home_points=0 (tie-band), away_points=-1 (below-tie)', () => {
    const games = [
      ...Array.from({ length: 10 }, homeWins),
      ...Array.from({ length: 8 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, aggregateInputs, games);
    expect(state.home_points).toBe(0); // tie band absorbs
    expect(state.away_points).toBe(-1); // (8-9)*1
  });
});

describe('evaluatePointsSystem — win-edge signal pattern (per-side triggers)', () => {
  // New model: per-side anytime triggers, each setting a side-specific literal
  // to a shared variable when that side's win count hits winTarget. Whichever
  // side reaches winTarget first sets `edge` to their name. single_shot keeps
  // each from re-firing; the win count only equals winTarget on the clinching
  // game, so the first side to clinch wins the `edge`.
  const composition: PointsSystem = {
    name: 'win_edge_test',
    thresholds: {
      winTarget: buildThresholdRow({
        name: 'winTarget',
        operationKind: 'read_pref',
        operationArgs: { pref_key: 'test_winTarget' },
      }),
    },
    triggers: [
      {
        name: 'homeWinEdge',
        type: 'anytime',
        condition: {
          kind: 'compare',
          left: { kind: 'var', name: 'home_wins' },
          op: '==',
          right: { kind: 'var', name: 'winTarget' },
        },
        action: { target: 'edge', value: { kind: 'set', value: 'home' } },
        rearm: 'single_shot',
        order: { number: 1, beforeAllocator: false },
      },
      {
        name: 'awayWinEdge',
        type: 'anytime',
        condition: {
          kind: 'compare',
          left: { kind: 'var', name: 'away_wins' },
          op: '==',
          right: { kind: 'var', name: 'winTarget' },
        },
        action: { target: 'edge', value: { kind: 'set', value: 'away' } },
        rearm: 'single_shot',
        order: { number: 2, beforeAllocator: false },
      },
    ],
  };

  const winChipInputs: ThresholdInputs = {
    ...emptyInputs,
    prefs: { test_winTarget: 10 },
  };

  it('home reaches 10 wins first → edge becomes "home"', () => {
    const games = [
      ...Array.from({ length: 10 }, homeWins),
      ...Array.from({ length: 7 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, winChipInputs, games);
    expect(state.edge).toBe('home');
  });

  it('away reaches 10 wins first → edge becomes "away"', () => {
    const games = [
      ...Array.from({ length: 10 }, awayWins),
      ...Array.from({ length: 7 }, homeWins),
    ];
    const state = evaluatePointsSystem(composition, winChipInputs, games);
    expect(state.edge).toBe('away');
  });

  it('neither side reaches 10 → edge never set (tie via absence of edge)', () => {
    const games = [
      ...Array.from({ length: 9 }, homeWins),
      ...Array.from({ length: 9 }, awayWins),
    ];
    const state = evaluatePointsSystem(composition, winChipInputs, games);
    expect(state.edge).toBeUndefined();
  });
});

describe('evaluatePointsSystem — multiple triggers fire on the clinching game (ordered, no halt)', () => {
  // Three anytime triggers share the same condition (home_wins == winTarget) and
  // fire in `order.number` sequence on the clinching game: bonus (expr add) →
  // edge (set) → endmatch flag (set). The new model has NO terminal/halt — the
  // match keeps processing every game; `endmatch` is just a flag, not a halt.
  const composition: PointsSystem = {
    name: 'clinch_cascade_test',
    thresholds: {
      winTarget: buildThresholdRow({
        name: 'winTarget',
        operationKind: 'read_pref',
        operationArgs: { pref_key: 'test_winTarget' },
      }),
    },
    perGameAllocator: {
      name: 'point_per_game',
      winner: { base: 1, formula: null },
      loser: { base: 0, formula: null },
    },
    triggers: [
      {
        name: 'homeWinBonus',
        type: 'anytime',
        condition: {
          kind: 'compare',
          left: { kind: 'var', name: 'home_wins' },
          op: '==',
          right: { kind: 'var', name: 'winTarget' },
        },
        action: {
          target: 'home_points',
          value: {
            kind: 'expr',
            expr: {
              kind: 'op',
              op: '+',
              left: { kind: 'var', name: 'home_points' },
              right: { kind: 'const', value: 3 },
            },
          },
        },
        rearm: 'single_shot',
        order: { number: 1, beforeAllocator: false },
      },
      {
        name: 'homeWinEdge',
        type: 'anytime',
        condition: {
          kind: 'compare',
          left: { kind: 'var', name: 'home_wins' },
          op: '==',
          right: { kind: 'var', name: 'winTarget' },
        },
        action: { target: 'edge', value: { kind: 'set', value: 'home' } },
        rearm: 'single_shot',
        order: { number: 2, beforeAllocator: false },
      },
      {
        name: 'homeWinEndmatch',
        type: 'anytime',
        condition: {
          kind: 'compare',
          left: { kind: 'var', name: 'home_wins' },
          op: '==',
          right: { kind: 'var', name: 'winTarget' },
        },
        action: { target: 'endmatch', value: { kind: 'set', value: true } },
        rearm: 'single_shot',
        order: { number: 3, beforeAllocator: false },
      },
    ],
  };

  const winInputs: ThresholdInputs = {
    ...emptyInputs,
    prefs: { test_winTarget: 3 },
  };

  it('cascade fires in order on the clinching game: bonus then edge then endmatch', () => {
    const games = [homeWins(), homeWins(), homeWins()];
    const state = evaluatePointsSystem(composition, winInputs, games);
    // Bonus added 3 on top of the 3 from per-game allocator (1 × 3 wins).
    expect(state.home_points).toBe(6);
    expect(state.edge).toBe('home');
    expect(state.endmatch).toBe(true);
  });

  it('no halt — subsequent games still process (endmatch is a flag, not a stop)', () => {
    // 3 wins clinch on game 3, but the match keeps running through all games.
    const games = [homeWins(), homeWins(), homeWins(), awayWins(), awayWins()];
    const state = evaluatePointsSystem(composition, winInputs, games);
    // home_wins stays at 3 (no more home wins); away accumulates its 2 wins.
    expect(state.home_wins).toBe(3);
    expect(state.away_wins).toBe(2);
    expect(state.endmatch).toBe(true);
    // single_shot — the clinch triggers fire only on game 3, so home_points
    // stays 6 (no double bonus on later games even though home_wins is still 3).
    expect(state.home_points).toBe(6);
  });
});
