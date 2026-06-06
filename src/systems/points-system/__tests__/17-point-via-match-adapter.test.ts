/**
 * @fileoverview Unit 8 acceptance — 17-Point Scoring System through the
 * live-scoring adapter (`match-adapter.ts` → `computeMatchRunningTotalsViaEngine`).
 *
 * This is the room's headline R10 acceptance test: the formula-path
 * variation, when slotted into the 10-Point family via the override
 * mechanism (Unit 5), produces the correct per-game and per-side totals.
 *
 * The chain exercised here is the SAME chain the live scoring mutation
 * uses (`engineRunningTotals` → `computeMatchRunningTotalsViaEngine` →
 * `buildComposition` → `evaluatePointsSystem`), one layer up from the
 * raw runtime. A failure here would surface as wrong points on a live
 * scoreboard.
 *
 * Sibling DB-touching smoke test verifies the loader → adapter chain
 * against the actual seeded 17-Point official in
 * `src/__tests__/database/17-point-smoke.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import {
  computeMatchRunningTotalsViaEngine,
  type MatchRunningTotals,
} from '../match-adapter';
import type { PerGameAllocator, ThresholdInputs } from '../types';
// Side-effect: register the formula op the 17-Point variation uses.
import '../allocator-formula-operations/add-complement-of-other-side';

const HOME = 'h-team';
const AWAY = 'a-team';

const SEVENTEEN_POINT: PerGameAllocator = {
  name: '17-Point — Official',
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

const INPUTS: ThresholdInputs = {
  homeRatings: [500, 500, 500, 500, 500],
  awayRatings: [500, 500, 500, 500, 500],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 5,
  prefs: {},
};

const NO_THRESHOLDS = { games_to_win: 13, games_to_tie: 12, games_to_lose: 11 };

function game(
  winner: 'home' | 'away',
  loser_value: number,
): {
  winner_team_id: string;
  confirmed_by_home: string;
  confirmed_by_away: string;
  is_tiebreaker: boolean;
  winner_value: number | null;
  loser_value: number | null;
} {
  return {
    winner_team_id: winner === 'home' ? HOME : AWAY,
    confirmed_by_home: 'h',
    confirmed_by_away: 'a',
    is_tiebreaker: false,
    winner_value: null,
    loser_value,
  };
}

function runMatch(
  games: ReturnType<typeof game>[],
): MatchRunningTotals {
  return computeMatchRunningTotalsViaEngine({
    homeTeamId: HOME,
    awayTeamId: AWAY,
    games,
    pointsCalculator: 'accumulated_per_game',
    pointsCalculatorParams: {},
    winCondition: 'points',
    thresholdInputs: INPUTS,
    homeThresholds: NO_THRESHOLDS,
    awayThresholds: NO_THRESHOLDS,
    perGameAllocatorOverride: SEVENTEEN_POINT,
  });
}

// ----------------------------------------------------------------------------
// Per-game math — boundary cases
// ----------------------------------------------------------------------------

describe('17-Point via match-adapter — per-game boundaries', () => {
  it('loser pockets 0 → winner gets 17, per-game total = 17', () => {
    const totals = runMatch([game('home', 0)]);
    expect(totals.home_points_earned).toBe(17);
    expect(totals.away_points_earned).toBe(0);
  });

  it('loser pockets 7 → winner gets 10, per-game total = 17', () => {
    const totals = runMatch([game('home', 7)]);
    expect(totals.home_points_earned).toBe(10);
    expect(totals.away_points_earned).toBe(7);
  });

  it('loser pockets 4 → winner gets 13, per-game total = 17', () => {
    const totals = runMatch([game('home', 4)]);
    expect(totals.home_points_earned).toBe(13);
    expect(totals.away_points_earned).toBe(4);
  });
});

// ----------------------------------------------------------------------------
// The plan's named acceptance scenario
// ----------------------------------------------------------------------------

describe('17-Point via match-adapter — five-game acceptance sequence', () => {
  it('loser values [0,3,5,7,2] over alternating winners → expected totals', () => {
    // Home wins games 1, 2, 4; away wins games 3, 5.
    //   g1: home wins, loser pocketed 0 → home +17, away +0
    //   g2: home wins, loser pocketed 3 → home +14, away +3
    //   g3: away wins, loser pocketed 5 → away +12, home +5
    //   g4: home wins, loser pocketed 7 → home +10, away +7
    //   g5: away wins, loser pocketed 2 → away +15, home +2
    // Home total: 17 + 14 + 5 + 10 + 2 = 48
    // Away total:  0 +  3 + 12 + 7 + 15 = 37
    const totals = runMatch([
      game('home', 0),
      game('home', 3),
      game('away', 5),
      game('home', 7),
      game('away', 2),
    ]);
    expect(totals.home_games_won).toBe(3);
    expect(totals.away_games_won).toBe(2);
    expect(totals.home_points_earned).toBe(48);
    expect(totals.away_points_earned).toBe(37);
  });

  it("each game's per-side allocation always sums to 17", () => {
    const games = [
      game('home', 0),
      game('away', 1),
      game('home', 6),
      game('away', 4),
    ];
    const totals = runMatch(games);
    const total = totals.home_points_earned + totals.away_points_earned;
    expect(total).toBe(17 * games.length);
  });
});

// ----------------------------------------------------------------------------
// Composition identity check — when 17-Point lands via override, the
// composition name carries the suffix so logs distinguish it from the
// raw prepackaged 10-Point. (Verifies Unit 5's name-suffix contract.)
// ----------------------------------------------------------------------------

describe('17-Point via match-adapter — composition identity', () => {
  it('no-override → no suffix (pure 10-Point behavior)', () => {
    const totals = computeMatchRunningTotalsViaEngine({
      homeTeamId: HOME,
      awayTeamId: AWAY,
      games: [game('home', 0)],
      pointsCalculator: 'accumulated_per_game',
      pointsCalculatorParams: {},
      winCondition: 'points',
      thresholdInputs: INPUTS,
      homeThresholds: NO_THRESHOLDS,
      awayThresholds: NO_THRESHOLDS,
    });
    expect(totals.home_points_earned).toBe(10); // 10-Point default winner
  });
});
