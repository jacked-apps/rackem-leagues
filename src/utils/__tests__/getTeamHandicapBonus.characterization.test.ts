/**
 * @fileoverview Characterization tests for getTeamHandicapBonus.
 *
 * Locks the season-level team handicap bonus formula used by BCA 3v3
 * points-handicap leagues. The bonus is applied ONLY to the home team's
 * effective handicap (added before chart lookup) and ONLY when the
 * league's handicap_type is 'points'.
 *
 * Formula:
 *   bonus = Math.floor((homeWins - awayWins) / 2)
 *
 * Where homeWins and awayWins are counts of completed matches the home
 * team and away team have won this season, respectively. The bonus can
 * be negative (penalty) when the away team is ahead. Returns 0 for
 * non-points handicap types and on DB errors (defensive default).
 *
 * Why this matters for the modular-league refactor: Phase 5 (Unit 5.1
 * runtime resolver) and the broader rating-mutation work in Phase 6
 * may touch the team-bonus calculation indirectly when restructuring
 * how preferences flow into the threshold computation. Locking the
 * formula here means we'd catch any silent change to the bonus math.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTeamHandicapBonus } from '../getTeamHandicapBonus';

// Mock the supabase client. The function does ONE query
// (matches.select('winner_team_id').eq.eq) and we simulate its result
// by returning canned data per test.
vi.mock('@/supabaseClient', () => {
  const eqChain = {
    eq: vi.fn(),
  };
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => eqChain),
        })),
      })),
    },
  };
});

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { supabase } from '@/supabaseClient';

/**
 * Helper to set up the supabase mock to return a specific list of matches.
 * The real query chain is .from('matches').select(...).eq(season_id).eq(status).
 * We return the canned `matches` array from the final eq.
 */
function mockMatchesQuery(matches: Array<{ winner_team_id: string }>) {
  vi.mocked(supabase.from).mockImplementation(() => {
    const finalChain = Promise.resolve({ data: matches, error: null }) as any;
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => finalChain),
        })),
      })),
    } as any;
  });
}

function mockMatchesQueryError(message: string) {
  vi.mocked(supabase.from).mockImplementation(() => {
    const finalChain = Promise.resolve({
      data: null,
      error: { message },
    }) as any;
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => finalChain),
        })),
      })),
    } as any;
  });
}

const HOME = 'home-team-id';
const AWAY = 'away-team-id';
const SEASON = 'season-id';

describe('getTeamHandicapBonus — characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handicap_type gate (only points uses team bonus)', () => {
    it('returns 0 for percentage handicap (no DB call)', async () => {
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'percentage');
      expect(result).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns 0 for fargo handicap (no DB call)', async () => {
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'fargo');
      expect(result).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns 0 for none handicap type (no DB call)', async () => {
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'none');
      expect(result).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns 0 for unknown handicap types (no DB call, defensive default)', async () => {
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'made_up');
      expect(result).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('formula: floor((homeWins - awayWins) / 2)', () => {
    it('returns 0 when no matches have been played', async () => {
      mockMatchesQuery([]);
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      expect(result).toBe(0);
    });

    it('returns 0 when home and away have equal wins', async () => {
      // 3 home wins, 3 away wins → diff 0 → bonus 0
      mockMatchesQuery([
        { winner_team_id: HOME },
        { winner_team_id: HOME },
        { winner_team_id: HOME },
        { winner_team_id: AWAY },
        { winner_team_id: AWAY },
        { winner_team_id: AWAY },
      ]);
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      expect(result).toBe(0);
    });

    it('+1 bonus when home leads by 2 wins (home up 4-2)', async () => {
      mockMatchesQuery([
        { winner_team_id: HOME },
        { winner_team_id: HOME },
        { winner_team_id: HOME },
        { winner_team_id: HOME },
        { winner_team_id: AWAY },
        { winner_team_id: AWAY },
      ]);
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      // (4 - 2) / 2 = 1
      expect(result).toBe(1);
    });

    it('+2 bonus when home leads by 5 wins (home up 8-3, floors to +2)', async () => {
      const matches = [
        ...Array(8).fill({ winner_team_id: HOME }),
        ...Array(3).fill({ winner_team_id: AWAY }),
      ];
      mockMatchesQuery(matches);
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      // (8 - 3) / 2 = 2.5 → floor → 2
      expect(result).toBe(2);
    });

    it('+0 bonus when home leads by 1 win (1/2 = 0.5 floors to 0)', async () => {
      mockMatchesQuery([
        { winner_team_id: HOME },
        { winner_team_id: HOME },
        { winner_team_id: AWAY },
      ]);
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      // (2 - 1) / 2 = 0.5 → floor → 0
      expect(result).toBe(0);
    });

    it('-2 penalty when away leads by 4 wins (home down 3-7)', async () => {
      const matches = [
        ...Array(3).fill({ winner_team_id: HOME }),
        ...Array(7).fill({ winner_team_id: AWAY }),
      ];
      mockMatchesQuery(matches);
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      // (3 - 7) / 2 = -2 → floor → -2
      expect(result).toBe(-2);
    });

    it('-3 penalty when away leads by 5 wins (home down 0-5, floor of -2.5)', async () => {
      mockMatchesQuery([
        { winner_team_id: AWAY },
        { winner_team_id: AWAY },
        { winner_team_id: AWAY },
        { winner_team_id: AWAY },
        { winner_team_id: AWAY },
      ]);
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      // (0 - 5) / 2 = -2.5 → floor → -3 (Math.floor rounds toward -Infinity)
      expect(result).toBe(-3);
    });

    it('ignores matches won by neither team (forfeits, etc.)', async () => {
      mockMatchesQuery([
        { winner_team_id: HOME },
        { winner_team_id: HOME },
        { winner_team_id: 'unrelated-team-id' }, // not home or away
        { winner_team_id: AWAY },
      ]);
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      // Counted: 2 home, 1 away → (2 - 1) / 2 = 0.5 → 0
      expect(result).toBe(0);
    });
  });

  describe('error and edge handling (defensive 0 default)', () => {
    it('returns 0 when the supabase query returns an error', async () => {
      mockMatchesQueryError('connection refused');
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      expect(result).toBe(0);
    });

    it('returns 0 when the supabase query throws (catch handler)', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('network exploded');
      });
      const result = await getTeamHandicapBonus(HOME, AWAY, SEASON, 'points');
      expect(result).toBe(0);
    });
  });
});
