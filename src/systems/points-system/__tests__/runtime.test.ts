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
import { buildThresholdRow } from '../threshold-resolver';
// Side-effect imports: register the operations these tests reference.
import '../operations/read-pref';
import '../operations/arithmetic-round-product';
import type { PointsSystem, ThresholdInputs, Trigger } from '../types';

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
  // Triggers (locked model — per-side, concrete, no shortcuts):
  //   - homeMilestone: when home_wins === milestoneTarget AND home won this game,
  //                    assign home_points = 1.5 (jump replaces running total)
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
        input: { thresholdRef: 'milestoneTarget' },
        when: { kind: 'side_reaches', side: 'home', sideVar: 'home_wins' },
        action: {
          target: { kind: 'concrete', variableName: 'home_points' },
          op: 'assign',
          value: { kind: 'literal', value: 1.5 },
        },
      },
      {
        name: 'awayMilestone',
        input: { thresholdRef: 'milestoneTarget' },
        when: { kind: 'side_reaches', side: 'away', sideVar: 'away_wins' },
        action: {
          target: { kind: 'concrete', variableName: 'away_points' },
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

describe('evaluatePointsSystem — receipt-trigger initial points (FargoRate start_points pattern)', () => {
  // Receipt triggers add the trigger's bound input value (n) to the per-side
  // points variables at match start. Threshold values come from prefs to keep
  // the test self-contained.
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
        input: { thresholdRef: 'initialHome' },
        when: { kind: 'receipt' },
        action: {
          target: { kind: 'concrete', variableName: 'home_points' },
          op: 'add',
          value: { kind: 'input_ref' },
        },
      },
      {
        name: 'award_initial_away',
        input: { thresholdRef: 'initialAway' },
        when: { kind: 'receipt' },
        action: {
          target: { kind: 'concrete', variableName: 'away_points' },
          op: 'add',
          value: { kind: 'input_ref' },
        },
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
  // Receipt triggers surface chart-target values into the state bag for the
  // aggregate to read. End-of-match aggregate applies the linear_above_threshold
  // formula with the locked tie-band absorption rule.
  const TARGET_NAMES = [
    'homeWinTarget',
    'awayWinTarget',
    'homeTieTarget',
    'awayTieTarget',
    'homeLoseTarget',
    'awayLoseTarget',
  ] as const;

  const assignThresholdToSelf = (name: string): Trigger => ({
    name: `assign_${name}`,
    input: { thresholdRef: name },
    when: { kind: 'receipt' },
    action: {
      target: { kind: 'concrete', variableName: name },
      op: 'assign',
      value: { kind: 'input_ref' },
    },
  });

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
    triggers: TARGET_NAMES.map(assignThresholdToSelf),
    endOfMatchAggregate: linearAboveThresholdAggregate({ multiplier: 1 }),
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
  // Locked model: per-side triggers, each writing a side-specific literal to
  // a shared variable. Whichever side wins first sets `edge` to their name;
  // the other side's trigger never gets to fire if endmatch is terminal.
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
        input: { thresholdRef: 'winTarget' },
        when: { kind: 'side_reaches', side: 'home', sideVar: 'home_wins' },
        action: {
          target: { kind: 'concrete', variableName: 'edge' },
          op: 'assign',
          value: { kind: 'literal', value: 'home' },
        },
      },
      {
        name: 'awayWinEdge',
        input: { thresholdRef: 'winTarget' },
        when: { kind: 'side_reaches', side: 'away', sideVar: 'away_wins' },
        action: {
          target: { kind: 'concrete', variableName: 'edge' },
          op: 'assign',
          value: { kind: 'literal', value: 'away' },
        },
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

describe('evaluatePointsSystem — terminal trigger halts the cascade', () => {
  // Cascade: bonus → edge → endmatch (terminal). Subsequent games never
  // process; never-fired triggers don't run.
  const composition: PointsSystem = {
    name: 'terminal_test',
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
        input: { thresholdRef: 'winTarget' },
        when: { kind: 'side_reaches', side: 'home', sideVar: 'home_wins' },
        action: {
          target: { kind: 'concrete', variableName: 'home_points' },
          op: 'add',
          value: { kind: 'literal', value: 3 },
        },
      },
      {
        name: 'homeWinEdge',
        input: { thresholdRef: 'winTarget' },
        when: { kind: 'side_reaches', side: 'home', sideVar: 'home_wins' },
        action: {
          target: { kind: 'concrete', variableName: 'edge' },
          op: 'assign',
          value: { kind: 'literal', value: 'home' },
        },
      },
      {
        name: 'homeWinEndmatch',
        input: { thresholdRef: 'winTarget' },
        when: { kind: 'side_reaches', side: 'home', sideVar: 'home_wins' },
        action: {
          target: { kind: 'concrete', variableName: 'endmatch' },
          op: 'assign',
          value: { kind: 'literal', value: true },
        },
        terminal: true,
      },
    ],
  };

  const winInputs: ThresholdInputs = {
    ...emptyInputs,
    prefs: { test_winTarget: 3 },
  };

  it('cascade fires in order: bonus then edge then endmatch (terminal)', () => {
    const games = [homeWins(), homeWins(), homeWins()];
    const state = evaluatePointsSystem(composition, winInputs, games);
    // Bonus added 3 on top of the 3 from per-game allocator (1 × 3 wins).
    expect(state.home_points).toBe(6);
    expect(state.edge).toBe('home');
    expect(state.endmatch).toBe(true);
  });

  it('terminal halts remaining games — subsequent games do not process', () => {
    // 3 wins clinch; the 4th game record is provided but should be ignored.
    const games = [homeWins(), homeWins(), homeWins(), awayWins(), awayWins()];
    const state = evaluatePointsSystem(composition, winInputs, games);
    // home_wins stops at 3 (the clinching game); away never gets to win.
    expect(state.home_wins).toBe(3);
    expect(state.away_wins).toBe(0);
    expect(state.endmatch).toBe(true);
  });
});
