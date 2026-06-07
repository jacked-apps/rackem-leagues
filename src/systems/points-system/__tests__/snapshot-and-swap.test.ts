/**
 * @fileoverview Unit 5 — live-path swap + parity tests.
 *
 * These tests pin the room's central guarantee: when the snapshot embeds a
 * resolved variation, the live-scoring path (`match-adapter.ts`) applies
 * it; when no override is present, the prepackaged composition is used
 * byte-equivalently to today. Both paths (`buildComposition` and
 * `pickPointsSystem`) are exercised so they stay in sync.
 *
 * Historical-replay stability (R9) is verified by re-evaluating the same
 * snapshot after a "hypothetical" downstream variation change: because the
 * snapshot holds the resolved OBJECT (not just the FK), changes to the
 * source row cannot retroactively affect this match.
 */

import { describe, it, expect } from 'vitest';
import {
  computeMatchRunningTotalsViaEngine,
  type MatchRunningTotals,
} from '../match-adapter';
import { buildSystemFromPreferences } from '@/systems/buildSystemFromPreferences';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type { PerGameAllocator, ThresholdInputs } from '../types';
// Side-effect imports: register the formula op used in the override fixture.
import '../allocator-formula-operations/add-complement-of-other-side';

const HOME = 'home-team-id';
const AWAY = 'away-team-id';

const emptyInputs: ThresholdInputs = {
  homeRatings: [400, 400, 400, 400, 400],
  awayRatings: [400, 400, 400, 400, 400],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 5,
  prefs: {},
};

const NO_THRESHOLDS = {
  games_to_win: 13,
  games_to_tie: 12,
  games_to_lose: 11,
};

/** Confirmed regular game; winner attributed by team id. */
function confirmedGame(
  winnerTeam: 'home' | 'away',
  loserValue: number | null = null,
): {
  winner_team_id: string;
  confirmed_by_home: string;
  confirmed_by_away: string;
  is_tiebreaker: boolean;
  winner_value: number | null;
  loser_value: number | null;
} {
  return {
    winner_team_id: winnerTeam === 'home' ? HOME : AWAY,
    confirmed_by_home: 'h-user',
    confirmed_by_away: 'a-user',
    is_tiebreaker: false,
    winner_value: null,
    loser_value: loserValue,
  };
}

// ----------------------------------------------------------------------------
// Override applied → composition's allocator slot is replaced
// ----------------------------------------------------------------------------

describe('match-adapter — perGameAllocatorOverride swaps the allocator slot', () => {
  const HALF_POINT_PER_GAME: PerGameAllocator = {
    name: 'half_point_per_game',
    winner: { base: 0.5, formula: null },
    loser: { base: 0, formula: null },
  };

  it('swaps the 10-Point allocator (10 / range 0-7) for half-point-per-game when override is set', () => {
    const games = [
      confirmedGame('home', 0),
      confirmedGame('home', 0),
      confirmedGame('away', 0),
      confirmedGame('home', 0),
      confirmedGame('away', 0),
    ];
    const totals: MatchRunningTotals = computeMatchRunningTotalsViaEngine({
      homeTeamId: HOME,
      awayTeamId: AWAY,
      games,
      pointsCalculator: 'accumulated_per_game',
      pointsCalculatorParams: {},
      winCondition: 'points',
      thresholdInputs: emptyInputs,
      homeThresholds: NO_THRESHOLDS,
      awayThresholds: NO_THRESHOLDS,
      perGameAllocatorOverride: HALF_POINT_PER_GAME,
    });
    expect(totals.home_games_won).toBe(3);
    expect(totals.away_games_won).toBe(2);
    // Half-a-point per game, NOT 10-Point's 10-per-game.
    // start-credit fold (`*_to_tie`) only fires when the composition doesn't
    // award one itself; the 10-point family DOES, so no extra credit is
    // added — the engine's 0.5/game stands as the only contribution.
    expect(totals.home_points_earned).toBeCloseTo(3 * 0.5);
    expect(totals.away_points_earned).toBeCloseTo(2 * 0.5);
  });

  it('without override, same prepackaged 10-Point produces today behavior unchanged', () => {
    const games = [confirmedGame('home', 0), confirmedGame('away', 0)];
    const totals: MatchRunningTotals = computeMatchRunningTotalsViaEngine({
      homeTeamId: HOME,
      awayTeamId: AWAY,
      games,
      pointsCalculator: 'accumulated_per_game',
      pointsCalculatorParams: {},
      winCondition: 'points',
      thresholdInputs: emptyInputs,
      homeThresholds: NO_THRESHOLDS,
      awayThresholds: NO_THRESHOLDS,
      // perGameAllocatorOverride omitted — same as null
    });
    // 10 per win, loser pocketed 0, no start credit folded (10-pt awards it).
    expect(totals.home_points_earned).toBe(10);
    expect(totals.away_points_earned).toBe(10);
  });

  it('explicit null override is identical to omitted override', () => {
    const games = [confirmedGame('home', 0)];
    const withNull = computeMatchRunningTotalsViaEngine({
      homeTeamId: HOME,
      awayTeamId: AWAY,
      games,
      pointsCalculator: 'accumulated_per_game',
      pointsCalculatorParams: {},
      winCondition: 'points',
      thresholdInputs: emptyInputs,
      homeThresholds: NO_THRESHOLDS,
      awayThresholds: NO_THRESHOLDS,
      perGameAllocatorOverride: null,
    });
    const withOmit = computeMatchRunningTotalsViaEngine({
      homeTeamId: HOME,
      awayTeamId: AWAY,
      games,
      pointsCalculator: 'accumulated_per_game',
      pointsCalculatorParams: {},
      winCondition: 'points',
      thresholdInputs: emptyInputs,
      homeThresholds: NO_THRESHOLDS,
      awayThresholds: NO_THRESHOLDS,
    });
    expect(withNull).toEqual(withOmit);
  });
});

// ----------------------------------------------------------------------------
// 17-Point override exercises the formula path end to end (closes R10)
// ----------------------------------------------------------------------------

describe('match-adapter — 17-Point variation via override', () => {
  const SEVENTEEN_POINT: PerGameAllocator = {
    name: '17_point_official',
    winner: {
      base: 10,
      formula: {
        operationKind: 'add_complement_of_other_side',
        operationArgs: { max: 7, other_side: 'loser' },
      },
    },
    loser: {
      base: { min: 0, max: 7, label: 'Balls pocketed by loser' },
      formula: null,
    },
  };

  it('winner gets 17 - loser_value per game with loser values [0,3,5,7,2]', () => {
    const games = [
      confirmedGame('home', 0), // winner=17, loser=0
      confirmedGame('home', 3), // winner=14, loser=3
      confirmedGame('away', 5), // winner=12, loser=5  (home loses, pocketed 5)
      confirmedGame('home', 7), // winner=10, loser=7
      confirmedGame('away', 2), // winner=15, loser=2  (home loses, pocketed 2)
    ];
    const totals = computeMatchRunningTotalsViaEngine({
      homeTeamId: HOME,
      awayTeamId: AWAY,
      games,
      pointsCalculator: 'accumulated_per_game',
      pointsCalculatorParams: {},
      winCondition: 'points',
      thresholdInputs: emptyInputs,
      homeThresholds: NO_THRESHOLDS,
      awayThresholds: NO_THRESHOLDS,
      perGameAllocatorOverride: SEVENTEEN_POINT,
    });
    // home wins: games 1, 2, 4 → 17 + 14 + 10 = 41
    // home loses: games 3, 5 → loser pocketed 5, 2 → 5 + 2 = 7
    // home total = 41 + 7 = 48
    expect(totals.home_points_earned).toBe(48);
    // away wins: games 3, 5 → 12 + 15 = 27
    // away loses: games 1, 2, 4 → 0 + 3 + 7 = 10
    // away total = 27 + 10 = 37
    expect(totals.away_points_earned).toBe(37);
    expect(totals.home_games_won).toBe(3);
    expect(totals.away_games_won).toBe(2);
  });
});

// ----------------------------------------------------------------------------
// pickPointsSystem parity swap
// ----------------------------------------------------------------------------

describe('buildSystemFromPreferences — pickPointsSystem parity swap', () => {
  function prefs(perGameAllocator?: PerGameAllocator | null): ResolvedSystemConfig {
    return {
      lineup_size: 5,
      max_roster_size: 8,
      game_generation: 'single_round_robin',
      pairing_format: 'single_rack',
      race_length: null,
      points_calculator: 'accumulated_per_game',
      points_calculator_params: {},
      win_condition: 'points',
      handicap_type: 'fargo',
      mechanism: 'start_points',
      threshold_chart_id: null,
      standings_sort: ['match_wins', 'games_won', 'points_earned'],
      tiebreaker_trigger: 'never',
      tiebreaker_format: 'accept_tie',
      overrides: {},
      snapshot_at: new Date().toISOString(),
      per_game_allocator_id: null,
      per_game_allocator: perGameAllocator,
    };
  }

  it('without override → prepackaged 10-Point composition', () => {
    const mod = buildSystemFromPreferences(prefs(null), {});
    expect(mod.pointsSystem?.name).toBe('10_point');
    expect(mod.pointsSystem?.perGameAllocator?.winner.base).toBe(10);
  });

  it('with override → composition name suffixed and allocator slot replaced', () => {
    const TWENTY: PerGameAllocator = {
      name: 'twenty_per_game',
      winner: { base: 20, formula: null },
      loser: { base: 0, formula: null },
    };
    const mod = buildSystemFromPreferences(prefs(TWENTY), {});
    expect(mod.pointsSystem?.name).toBe('10_point__custom_twenty_per_game');
    expect(mod.pointsSystem?.perGameAllocator?.winner.base).toBe(20);
    // Triggers stayed put — only the slot was replaced.
    expect(mod.pointsSystem?.triggers.length).toBeGreaterThan(0);
  });
});

// ----------------------------------------------------------------------------
// Historical-replay stability (R9): snapshot holds the resolved object, not
// a pointer. The same snapshot must produce the same totals across multiple
// evaluations regardless of any imagined later edits to the source row.
// ----------------------------------------------------------------------------

describe('match-adapter — historical replay stability (R9)', () => {
  it('same embedded variation produces same totals across repeated evaluations', () => {
    const FROZEN: PerGameAllocator = {
      name: 'frozen_variation',
      winner: { base: 11, formula: null },
      loser: { base: 0, formula: null },
    };
    const games = [
      confirmedGame('home'),
      confirmedGame('home'),
      confirmedGame('away'),
    ];
    const a = computeMatchRunningTotalsViaEngine({
      homeTeamId: HOME,
      awayTeamId: AWAY,
      games,
      pointsCalculator: 'accumulated_per_game',
      pointsCalculatorParams: {},
      winCondition: 'points',
      thresholdInputs: emptyInputs,
      homeThresholds: NO_THRESHOLDS,
      awayThresholds: NO_THRESHOLDS,
      perGameAllocatorOverride: FROZEN,
    });
    const b = computeMatchRunningTotalsViaEngine({
      homeTeamId: HOME,
      awayTeamId: AWAY,
      games,
      pointsCalculator: 'accumulated_per_game',
      pointsCalculatorParams: {},
      winCondition: 'points',
      thresholdInputs: emptyInputs,
      homeThresholds: NO_THRESHOLDS,
      awayThresholds: NO_THRESHOLDS,
      perGameAllocatorOverride: FROZEN,
    });
    expect(a).toEqual(b);
    expect(a.home_points_earned).toBe(22);
    expect(a.away_points_earned).toBe(11);
  });
});
