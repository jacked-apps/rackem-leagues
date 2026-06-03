/**
 * @fileoverview Integration tests for each system's prep-time chain.
 *
 * Builds a representative Context for each system and runs its chain
 * through the runtime. Asserts the bag ends up populated with the
 * expected threshold-payload keys.
 *
 * This is the cheapest test that confirms the chain wiring + module
 * order + interface compatibility all line up. Individual module
 * behavior is covered by per-module unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase BEFORE importing anything that imports it (teamBonus reaches DB)
vi.mock('@/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

const { runSystemChain } = await import('@/systems/chain-runtime/runSystemChain');
const { bca3v3Chain } = await import('@/systems/bca3v3');
const { bca5v5Chain } = await import('@/systems/bca5v5');
const { fargoPointsChain, fargoGamesChain } = await import('@/systems/fargo5v5');

function makeContext() {
  return {
    matchData: {
      id: 'match-1',
      home_team_id: 'team-home',
      away_team_id: 'team-away',
      season_id: 'season-1',
      home_to_tie: 12,
      away_to_tie: 0,
    },
    homeLineup: {
      id: 'lineup-home',
      player1_id: 'p1',
      player1_handicap: 500,
      player2_id: 'p2',
      player2_handicap: 550,
      player3_id: 'p3',
      player3_handicap: 600,
      player4_id: 'p4',
      player4_handicap: 525,
      player5_id: 'p5',
      player5_handicap: 575,
    },
    awayLineup: {
      id: 'lineup-away',
      player1_id: 'a1',
      player1_handicap: 480,
      player2_id: 'a2',
      player2_handicap: 530,
      player3_id: 'a3',
      player3_handicap: 580,
      player4_id: 'a4',
      player4_handicap: 510,
      player5_id: 'a5',
      player5_handicap: 555,
    },
    prefs: { lineupSize: 5, gameGeneration: 'single_round_robin' },
  };
}

describe('chains integration', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('bca3v3Chain populates the bag with the threshold trio for both sides', async () => {
    // BCA 3v3 uses Points handicaps (-2..+2), not Fargo ratings.
    const ctx = makeContext();
    ctx.homeLineup.player1_handicap = 0;
    ctx.homeLineup.player2_handicap = 1;
    ctx.homeLineup.player3_handicap = -1;
    ctx.awayLineup.player1_handicap = 2;
    ctx.awayLineup.player2_handicap = 0;
    ctx.awayLineup.player3_handicap = 0;
    ctx.prefs.lineupSize = 3;

    const bag = await runSystemChain(bca3v3Chain, ctx);

    expect(bag.match_id).toBe('match-1');
    expect(bag.home_handicaps).toEqual([0, 1, -1, 525, 575]);
    expect(bag.away_team_bonus).toBe(0);
    expect(typeof bag.home_handicap_diff).toBe('number');
    expect(bag.home_to_win).not.toBeNull();
    expect(bag.home_to_lose).not.toBeNull();
    expect(bag.away_to_win).not.toBeNull();
    expect(bag.away_to_lose).not.toBeNull();
  });

  it('bca5v5Chain populates the bag with the threshold trio (no team bonus)', async () => {
    const ctx = makeContext();
    // Use percentage-like values
    const setHandicaps = (lineup: typeof ctx.homeLineup, values: number[]) => {
      lineup.player1_handicap = values[0];
      lineup.player2_handicap = values[1];
      lineup.player3_handicap = values[2];
      lineup.player4_handicap = values[3];
      lineup.player5_handicap = values[4];
    };
    setHandicaps(ctx.homeLineup, [50, 60, 55, 70, 45]);
    setHandicaps(ctx.awayLineup, [40, 65, 50, 55, 60]);

    const bag = await runSystemChain(bca5v5Chain, ctx);

    expect(bag.home_handicaps).toEqual([50, 60, 55, 70, 45]);
    expect(bag.home_handicap_diff).toBe(10);
    expect(bag.away_handicap_diff).toBe(-10);
    expect(bag.home_to_win).not.toBeNull();
    expect(bag.away_to_win).not.toBeNull();
    // No team bonus module in this chain
    expect(bag.home_team_bonus).toBeUndefined();
  });

  it('fargoPointsChain copies negotiated start points to *_to_tie', async () => {
    const ctx = makeContext();
    const bag = await runSystemChain(fargoPointsChain, ctx);

    expect(bag.negotiated_home_start_points).toBe(12);
    expect(bag.negotiated_away_start_points).toBe(0);
    expect(bag.home_to_tie).toBe(12);
    expect(bag.away_to_tie).toBe(0);
    expect(bag.home_to_win).toBeNull();
    expect(bag.home_to_lose).toBeNull();
    expect(bag.away_to_win).toBeNull();
    expect(bag.away_to_lose).toBeNull();
  });

  it('fargoGamesChain populates all six threshold keys from team ratings', async () => {
    const ctx = makeContext();
    const bag = await runSystemChain(fargoGamesChain, ctx);

    expect(bag.total_games).toBe(25); // 5 * 5 * 1
    // Each threshold value is either a number or null depending on which
    // band the diff produces. The chain wires the helper output into the
    // bag for all six keys.
    const sixKeys = [
      'home_to_win',
      'home_to_tie',
      'home_to_lose',
      'away_to_win',
      'away_to_tie',
      'away_to_lose',
    ] as const;
    for (const key of sixKeys) {
      expect(bag).toHaveProperty(key);
      const v = bag[key];
      expect(v === null || typeof v === 'number').toBe(true);
    }
  });

  it('runtime never throws when context is mostly empty', async () => {
    const bag = await runSystemChain(bca3v3Chain, {});
    // Empty context → empty arrays → diffs default to 0 → chart returns the
    // even-match baseline (real numbers, not nulls). The runtime gracefully
    // degrades without throwing. That's the "never crash scoring" guarantee.
    expect(bag.away_team_bonus).toBe(0);
    expect(typeof bag.home_to_win).toBe('number');
    expect(typeof bag.away_to_win).toBe('number');
  });
});
