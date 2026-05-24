/**
 * @fileoverview Parity gate: NEW engine adapter vs. LEGACY running-totals calculator.
 *
 * `computeMatchRunningTotalsViaEngine` (new modular Points System engine path)
 * must return EXACTLY what the legacy `computeMatchRunningTotals` returns for
 * the same scenario. Legacy is the source of truth for parity — when a case
 * diverges, the adapter is wrong, never the assertion.
 *
 * Coverage:
 *  - All 3 prepackaged systems (Points 3-Man / Percentage 5-Man / 10-Point).
 *  - Every band + the extremes (sweep, shutout, tie band, edge crossings).
 *  - The relevant win-condition modes (games vs points) per system.
 *  - A couple of handicap diffs / param sets per system.
 *
 * Both paths are fed IDENTICAL `MinimalMatchGame[]` arrays (all confirmed,
 * non-tiebreaker) so the game-counting half is held constant and the points
 * half is what's actually under audit. Legacy per-side `HandicapThresholds`
 * are constructed from the SAME chart/diff the new engine resolves from, so
 * the two paths agree by construction (mirrors the cross-audit setup).
 *
 * @see ../match-adapter.ts — the adapter under test
 * @see ../../../utils/match/computeMatchRunningTotals.ts — the legacy source of truth
 * @see ./cross-audit-points-3-man.test.ts — the composition ↔ calculator audits
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import {
  clearRegistry,
  registerCalculator,
  linearAboveThreshold,
  accumulateWithMilestoneJumps,
  accumulatedPerGame,
} from '@/systems/calculators';
import { computeMatchRunningTotals } from '@/utils/match/computeMatchRunningTotals';
import {
  computeMatchRunningTotalsViaEngine,
  type MinimalMatchGame,
} from '../match-adapter';
import type { ThresholdInputs } from '../types';

// The legacy registry self-registers at module load, but we re-establish a
// clean, known set here so this file is isolated from registration order.
beforeAll(() => {
  clearRegistry();
  registerCalculator(linearAboveThreshold);
  registerCalculator(accumulateWithMilestoneJumps);
  registerCalculator(accumulatedPerGame);
});

const HOME = 'HOME';
const AWAY = 'AWAY';

/**
 * Build a confirmed, non-tiebreaker game with a given winner side + optional
 * loser counter value (balls pocketed for 10-Point). Both confirmer columns
 * are set so the game counts in both paths.
 */
function game(
  winnerSide: 'home' | 'away',
  loserValue: number | null = null,
  winnerValue: number | null = null,
): MinimalMatchGame {
  return {
    winner_team_id: winnerSide === 'home' ? HOME : AWAY,
    winner_value: winnerValue,
    loser_value: loserValue,
    is_tiebreaker: false,
    confirmed_by_home: 'h-confirmer',
    confirmed_by_away: 'a-confirmer',
  };
}

/**
 * Build a stream of `homeWins` home wins followed by `awayWins` away wins,
 * each with a fixed loser-counter value (0 for aggregate systems that ignore
 * it; varied for 10-Point).
 */
function winStream(
  homeWins: number,
  awayWins: number,
  loserValue: number | null = null,
): MinimalMatchGame[] {
  return [
    ...Array.from({ length: homeWins }, () => game('home', loserValue)),
    ...Array.from({ length: awayWins }, () => game('away', loserValue)),
  ];
}

/**
 * Assert parity between the legacy calculator and the engine adapter for one
 * fully-specified scenario.
 *
 * Game counts are integers and must match EXACTLY. Points match to 10 decimal
 * places (`toBeCloseTo`, the cross-audit suite's established tolerance). The
 * tolerance exists because the per-game-accumulating Percentage 5-Man engine
 * sums `0.1`-style increments game-by-game while the legacy aggregate computes
 * the same result in closed form — the two are mathematically equal but differ
 * in IEEE-754 last-bit representation (e.g. `7.4` vs `7.400000000000002`). The
 * closed-form Points 3-Man and integer 10-Point paths match to the bit; the
 * tolerance only ever absorbs the float-accumulation noise, never a real
 * scoring divergence.
 */
function assertParity(
  legacyArgs: Parameters<typeof computeMatchRunningTotals>[0],
  engineArgs: Parameters<typeof computeMatchRunningTotalsViaEngine>[0],
): void {
  const legacy = computeMatchRunningTotals(legacyArgs);
  const engine = computeMatchRunningTotalsViaEngine(engineArgs);
  expect(engine.home_games_won).toBe(legacy.home_games_won);
  expect(engine.away_games_won).toBe(legacy.away_games_won);
  expect(engine.home_points_earned).toBeCloseTo(legacy.home_points_earned, 10);
  expect(engine.away_points_earned).toBeCloseTo(legacy.away_points_earned, 10);
}

// ============================================================================
// System 1 — Points 3-Man (linear_above_threshold)
// ============================================================================

describe('Parity: Points 3-Man (linear_above_threshold)', () => {
  const HANDICAP_DIFFS = [-12, -8, -4, -2, -1, 0, 1, 2, 4, 8, 12];
  const MULTIPLIERS = [1, 2, 0.5];
  // 18-game format (3v3 DRR). Hit every band + extremes for each side.
  const OUTCOMES: Array<[number, number]> = Array.from(
    { length: 19 },
    (_, h) => [h, 18 - h] as [number, number],
  );

  for (const diff of HANDICAP_DIFFS) {
    for (const multiplier of MULTIPLIERS) {
      // Both win-condition modes — points-mode exercises the *_to_tie
      // start-credit fold-in (Points 3-Man composition has no match_start
      // points trigger, so the adapter must add it the way legacy does).
      for (const winCondition of ['games', 'points'] as const) {
        // eslint-disable-next-line vitest/valid-title
        describe(`diff=${diff}, mult=${multiplier}, ${winCondition}`, () => {
          const homeThresholds = get3v3GamesNeeded(diff);
          const awayThresholds = get3v3GamesNeeded(-diff);
          const params = { per_extra_game_multiplier: multiplier };
          const thresholdInputs: ThresholdInputs = {
            homeRatings: [],
            awayRatings: [],
            homeHandicapDiff: diff,
            awayHandicapDiff: -diff,
            gameCount: 18,
            prefs: {},
          };

          it.each(OUTCOMES)('home=%i away=%i', (homeWins, awayWins) => {
            const games = winStream(homeWins, awayWins);
            assertParity(
              {
                homeTeamId: HOME,
                awayTeamId: AWAY,
                homeThresholds,
                awayThresholds,
                games,
                pointsCalculator: 'linear_above_threshold',
                pointsCalculatorParams: params,
                winCondition,
              },
              {
                homeTeamId: HOME,
                awayTeamId: AWAY,
                games,
                pointsCalculator: 'linear_above_threshold',
                pointsCalculatorParams: params,
                winCondition,
                thresholdInputs,
                homeThresholds,
                awayThresholds,
              },
            );
          });
        });
      }
    }
  }
});

// ============================================================================
// System 2 — Percentage 5-Man (accumulate_with_milestone_jumps)
// ============================================================================

describe('Parity: Percentage 5-Man (accumulate_with_milestone_jumps)', () => {
  interface MilestoneParams {
    per_game_increment: number;
    milestone_percent: number;
    milestone_jump_value: number;
    win_threshold_jump_value: number;
  }
  const PARAM_SETS: MilestoneParams[] = [
    {
      per_game_increment: 0.1,
      milestone_percent: 0.7,
      milestone_jump_value: 1.5,
      win_threshold_jump_value: 3.0,
    },
    {
      per_game_increment: 0.2,
      milestone_percent: 0.6,
      milestone_jump_value: 2.0,
      win_threshold_jump_value: 5.0,
    },
  ];
  const GAMES_TO_WIN = 13;
  // 25-game format (5v5 SRR). 0..25 home wins covers sub-milestone, milestone
  // band, win band, and the sweep/shutout extremes.
  const OUTCOMES: Array<[number, number]> = Array.from(
    { length: 26 },
    (_, h) => [h, 25 - h] as [number, number],
  );

  for (let i = 0; i < PARAM_SETS.length; i++) {
    const params = PARAM_SETS[i]!;
    // accumulate_with_milestone_jumps uses games_to_tie: null (5v5 can't tie),
    // so points-mode start-credit folds in 0. We still test points-mode to
    // prove the adapter handles winCondition correctly without divergence.
    for (const winCondition of ['games', 'points'] as const) {
      // eslint-disable-next-line vitest/valid-title
      describe(`param set ${i + 1}, ${winCondition}`, () => {
        // 5v5 can't tie; games_to_tie is null → start-credit fold-in is 0.
        const thresholds = {
          games_to_win: GAMES_TO_WIN,
          games_to_tie: null,
          games_to_lose: 0,
        };
        const thresholdInputs: ThresholdInputs = {
          homeRatings: [],
          awayRatings: [],
          homeHandicapDiff: 0,
          awayHandicapDiff: 0,
          gameCount: 25,
          prefs: {
            games_to_win: GAMES_TO_WIN,
            milestone_percent: params.milestone_percent,
          },
        };

        it.each(OUTCOMES)('home=%i away=%i', (homeWins, awayWins) => {
          const games = winStream(homeWins, awayWins);
          assertParity(
            {
              homeTeamId: HOME,
              awayTeamId: AWAY,
              homeThresholds: thresholds,
              awayThresholds: thresholds,
              games,
              pointsCalculator: 'accumulate_with_milestone_jumps',
              pointsCalculatorParams: params,
              winCondition,
            },
            {
              homeTeamId: HOME,
              awayTeamId: AWAY,
              games,
              pointsCalculator: 'accumulate_with_milestone_jumps',
              pointsCalculatorParams: params,
              winCondition,
              thresholdInputs,
              homeThresholds: thresholds,
              awayThresholds: thresholds,
            },
          );
        });
      });
    }
  }
});

// ============================================================================
// System 3 — 10-Point (accumulated_per_game)
// ============================================================================

describe('Parity: 10-Point (accumulated_per_game)', () => {
  const FARGO_PARAMS = {
    winner: { kind: 'fixed' as const, points: 10 },
    loser: { kind: 'counter' as const, min: 0, max: 7, label: 'Balls pocketed by loser' },
  };

  // Representative game streams: counter clamp boundaries (0, 7), mid-range,
  // sweep, and a mixed split.
  const STREAMS: Array<{ label: string; specs: Array<['home' | 'away', number]> }> = [
    {
      label: 'home sweeps, loser pockets 0',
      specs: Array.from({ length: 25 }, () => ['home', 0] as ['home' | 'away', number]),
    },
    {
      label: 'home sweeps, loser pockets 7 (clamp ceiling)',
      specs: Array.from({ length: 25 }, () => ['home', 7] as ['home' | 'away', number]),
    },
    {
      label: 'mixed 13-12 home, varied loser balls',
      specs: [
        ...Array.from(
          { length: 13 },
          (_, i) => ['home', i % 8] as ['home' | 'away', number],
        ),
        ...Array.from(
          { length: 12 },
          (_, i) => ['away', (i + 3) % 8] as ['home' | 'away', number],
        ),
      ],
    },
    {
      label: 'alternating, loser pockets 3 each',
      specs: Array.from(
        { length: 25 },
        (_, i) => [(i % 2 === 0 ? 'home' : 'away'), 3] as ['home' | 'away', number],
      ),
    },
  ];

  function buildGames(specs: Array<['home' | 'away', number]>): MinimalMatchGame[] {
    return specs.map(([side, loserBalls]) => game(side, loserBalls));
  }

  // Equal lineups → 0 start-points to both sides. The engine resolves this
  // from ratings; legacy reads games_to_tie (set to 0 here to match).
  describe('games-mode, equal lineups (no head-start)', () => {
    const equalRatings = [500, 500, 500, 500, 500];
    const thresholds = { games_to_win: null, games_to_tie: 0, games_to_lose: null };
    const thresholdInputs: ThresholdInputs = {
      homeRatings: equalRatings,
      awayRatings: equalRatings,
      homeHandicapDiff: 0,
      awayHandicapDiff: 0,
      gameCount: 25,
      prefs: {},
    };

    for (const stream of STREAMS) {
      it(stream.label, () => {
        const games = buildGames(stream.specs);
        assertParity(
          {
            homeTeamId: HOME,
            awayTeamId: AWAY,
            homeThresholds: thresholds,
            awayThresholds: thresholds,
            games,
            pointsCalculator: 'accumulated_per_game',
            pointsCalculatorParams: FARGO_PARAMS,
            winCondition: 'games',
          },
          {
            homeTeamId: HOME,
            awayTeamId: AWAY,
            games,
            pointsCalculator: 'accumulated_per_game',
            pointsCalculatorParams: FARGO_PARAMS,
            winCondition: 'games',
            thresholdInputs,
            homeThresholds: thresholds,
            awayThresholds: thresholds,
          },
        );
      });
    }
  });

  // Points-mode with a real FargoRate head-start. The engine computes the
  // 56-point head-start to the weaker (away) team from ratings; legacy folds
  // in games_to_tie. To keep both paths agreeing, the legacy away.games_to_tie
  // is set to the SAME 56 the engine derives, home.games_to_tie to 0.
  //
  // The adapter must NOT add games_to_tie on top of the engine's match_start
  // head-start (10-Point composition already awards it) — that's the
  // double-count guard. Parity here proves the guard is correct.
  describe('points-mode, FargoRate head-start (the double-count guard)', () => {
    const HOME_RATINGS = [567, 458, 493, 486, 574];
    const AWAY_RATINGS = [447, 394, 452, 322, 374]; // weaker → 56 head-start
    const ENGINE_HEADSTART_TO_AWAY = 56; // validated anchor (see cross-audit-10-point)
    // Legacy folds these in for points-mode; set to match the engine's
    // rating-derived head-start so the two paths agree.
    const homeThresholds = { games_to_win: null, games_to_tie: 0, games_to_lose: null };
    const awayThresholds = {
      games_to_win: null,
      games_to_tie: ENGINE_HEADSTART_TO_AWAY,
      games_to_lose: null,
    };
    const thresholdInputs: ThresholdInputs = {
      homeRatings: HOME_RATINGS,
      awayRatings: AWAY_RATINGS,
      homeHandicapDiff: 0,
      awayHandicapDiff: 0,
      gameCount: 25,
      prefs: {},
    };

    for (const stream of STREAMS) {
      it(stream.label, () => {
        const games = buildGames(stream.specs);
        assertParity(
          {
            homeTeamId: HOME,
            awayTeamId: AWAY,
            homeThresholds,
            awayThresholds,
            games,
            pointsCalculator: 'accumulated_per_game',
            pointsCalculatorParams: FARGO_PARAMS,
            winCondition: 'points',
          },
          {
            homeTeamId: HOME,
            awayTeamId: AWAY,
            games,
            pointsCalculator: 'accumulated_per_game',
            pointsCalculatorParams: FARGO_PARAMS,
            winCondition: 'points',
            thresholdInputs,
            homeThresholds,
            awayThresholds,
          },
        );
      });
    }

    it('empty match: head-start only, no per-game points', () => {
      const games: MinimalMatchGame[] = [];
      assertParity(
        {
          homeTeamId: HOME,
          awayTeamId: AWAY,
          homeThresholds,
          awayThresholds,
          games,
          pointsCalculator: 'accumulated_per_game',
          pointsCalculatorParams: FARGO_PARAMS,
          winCondition: 'points',
        },
        {
          homeTeamId: HOME,
          awayTeamId: AWAY,
          games,
          pointsCalculator: 'accumulated_per_game',
          pointsCalculatorParams: FARGO_PARAMS,
          winCondition: 'points',
          thresholdInputs,
          homeThresholds,
          awayThresholds,
        },
      );
    });
  });
});

// ============================================================================
// No-calculator paths
// ============================================================================

describe('Parity: no points tracking (null / none / unknown)', () => {
  const thresholds = { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 };
  const thresholdInputs: ThresholdInputs = {
    homeRatings: [],
    awayRatings: [],
    homeHandicapDiff: 0,
    awayHandicapDiff: 0,
    gameCount: 18,
    prefs: {},
  };
  const games = winStream(6, 4);

  for (const calc of [null, 'none', 'some_unregistered_calculator'] as const) {
    // points-mode too — even with a non-tracking calculator, neither path
    // should add start-credit (legacy returns early before the fold-in).
    for (const winCondition of ['games', 'points'] as const) {
      it(`calc=${String(calc)}, ${winCondition} → game counts only, 0 points`, () => {
        assertParity(
          {
            homeTeamId: HOME,
            awayTeamId: AWAY,
            homeThresholds: thresholds,
            awayThresholds: thresholds,
            games,
            pointsCalculator: calc,
            pointsCalculatorParams: {},
            winCondition,
          },
          {
            homeTeamId: HOME,
            awayTeamId: AWAY,
            games,
            pointsCalculator: calc,
            pointsCalculatorParams: {},
            winCondition,
            thresholdInputs,
            homeThresholds: thresholds,
            awayThresholds: thresholds,
          },
        );
      });
    }
  }
});

// ============================================================================
// Game-counting parity (filters held identical to legacy)
// ============================================================================

describe('Parity: game-counting filters (tiebreaker / unconfirmed / no-winner)', () => {
  const homeThresholds = get3v3GamesNeeded(0);
  const awayThresholds = get3v3GamesNeeded(0);
  const params = { per_extra_game_multiplier: 1 };
  const thresholdInputs: ThresholdInputs = {
    homeRatings: [],
    awayRatings: [],
    homeHandicapDiff: 0,
    awayHandicapDiff: 0,
    gameCount: 18,
    prefs: {},
  };

  it('excludes tiebreaker, unconfirmed, and winner-less games identically', () => {
    const games: MinimalMatchGame[] = [
      // counted: 11 home wins, 7 away wins
      ...winStream(11, 7),
      // tiebreaker — excluded
      { ...game('home'), is_tiebreaker: true },
      // unconfirmed by home — excluded
      { ...game('away'), confirmed_by_home: null },
      // unconfirmed by away — excluded
      { ...game('home'), confirmed_by_away: null },
      // no winner — excluded
      { ...game('home'), winner_team_id: null },
    ];
    assertParity(
      {
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds,
        awayThresholds,
        games,
        pointsCalculator: 'linear_above_threshold',
        pointsCalculatorParams: params,
        winCondition: 'games',
      },
      {
        homeTeamId: HOME,
        awayTeamId: AWAY,
        games,
        pointsCalculator: 'linear_above_threshold',
        pointsCalculatorParams: params,
        winCondition: 'games',
        thresholdInputs,
        homeThresholds,
        awayThresholds,
      },
    );
  });
});
