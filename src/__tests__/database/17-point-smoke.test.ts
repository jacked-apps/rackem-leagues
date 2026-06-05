/**
 * @vitest-environment jsdom
 *
 * @fileoverview Unit 8 smoke test — full pipeline through the seeded
 * 17-Point official.
 *
 * Exercises the chain: DB row → loader → match-adapter → engine. This
 * proves the seed (Unit 1) actually produces a usable variation, the
 * loader (Unit 2) parses its JSONB correctly, the validator (Unit 3)
 * accepts it, and the adapter (Unit 5) routes the formula path through
 * to the engine correctly. Together with `17-point-via-match-adapter`
 * this is the room's acceptance test for R10.
 *
 * Pragma: `jsdom` per [[project_happy_dom_supabase_insert_limit]] — the
 * loader uses supabase-js select; happy-dom mangles POSTs but here we
 * only read, so jsdom is the conservative pick to match the loader's
 * own test convention.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { executeSql, closePostgresPool, createTestClient } from '@/test/dbTestUtils';
// Side-effect: register the formula op the 17-Point seeded official references.
import '@/systems/points-system/allocator-formula-operations/evaluate-expression';

// The loader imports supabase from `@/supabaseClient`, which reads
// `VITE_SUPABASE_URL` from import.meta.env — not populated in the test
// runner. Point the loader at the local supabase instance instead.
vi.mock('@/supabaseClient', () => ({
  supabase: createTestClient(),
}));

const { loadPerGameAllocator } = await import(
  '@/systems/points-system/per-game-allocator-loader'
);
const { computeMatchRunningTotalsViaEngine } = await import(
  '@/systems/points-system/match-adapter'
);

const HOME = 'h-team';
const AWAY = 'a-team';

const INPUTS = {
  homeRatings: [500, 500, 500, 500, 500],
  awayRatings: [500, 500, 500, 500, 500],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 5,
  prefs: {},
};

const NO_THRESHOLDS = { games_to_win: 13, games_to_tie: 12, games_to_lose: 11 };

function game(winner: 'home' | 'away', loser_value: number) {
  return {
    winner_team_id: winner === 'home' ? HOME : AWAY,
    confirmed_by_home: 'h',
    confirmed_by_away: 'a',
    is_tiebreaker: false,
    winner_value: null,
    loser_value,
  };
}

describe('17-Point — full pipeline smoke', () => {
  let seventeenPointId: string | null = null;

  beforeAll(async () => {
    const rows = await executeSql(
      `SELECT id FROM per_game_allocators WHERE name = '17-Point — Official'`,
    );
    seventeenPointId = (rows[0]?.id as string | undefined) ?? null;
  });

  afterAll(async () => {
    await closePostgresPool();
  });

  it('seeded 17-Point official exists', () => {
    expect(seventeenPointId).not.toBeNull();
  });

  it('loader pulls a valid PerGameAllocator from the seeded row', async () => {
    if (!seventeenPointId) throw new Error('no seed');
    const allocator = await loadPerGameAllocator(seventeenPointId);
    expect(allocator).not.toBeNull();
    expect(allocator?.winner.formula?.operationKind).toBe(
      'evaluate_expression',
    );
    // The expression tree encodes `(this_side_value + (7 - other_side_value))`
    expect(allocator?.winner.formula?.operationArgs).toEqual({
      expression: {
        kind: 'op',
        op: '-',
        left: { kind: 'const', value: 17 },
        right: { kind: 'var', name: 'other_side_value' },
      },
    });
    expect(allocator?.winner.base).toBe(0);
    expect(allocator?.loser.base).toEqual({
      min: 0,
      max: 7,
      label: 'Balls pocketed by loser',
    });
  });

  it('loaded allocator → match-adapter → correct 17-Point totals over the named acceptance sequence', async () => {
    if (!seventeenPointId) throw new Error('no seed');
    const allocator = await loadPerGameAllocator(seventeenPointId);
    expect(allocator).not.toBeNull();
    const totals = computeMatchRunningTotalsViaEngine({
      homeTeamId: HOME,
      awayTeamId: AWAY,
      games: [
        game('home', 0),
        game('home', 3),
        game('away', 5),
        game('home', 7),
        game('away', 2),
      ],
      pointsCalculator: 'accumulated_per_game',
      pointsCalculatorParams: {},
      winCondition: 'points',
      thresholdInputs: INPUTS,
      homeThresholds: NO_THRESHOLDS,
      awayThresholds: NO_THRESHOLDS,
      perGameAllocatorOverride: allocator!,
    });
    // Same numbers as 17-point-via-match-adapter — confirms the seed's
    // JSONB matches the in-memory fixture used there.
    expect(totals.home_games_won).toBe(3);
    expect(totals.away_games_won).toBe(2);
    expect(totals.home_points_earned).toBe(48);
    expect(totals.away_points_earned).toBe(37);
  });
});
