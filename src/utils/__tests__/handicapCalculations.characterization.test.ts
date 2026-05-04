/**
 * @fileoverview Characterization tests for handicapCalculations utilities.
 *
 * Locks two functions exposed by `src/utils/handicapCalculations.ts`:
 *
 *   1. `getSubstituteHandicapOptions(variant)` — returns the valid handicap
 *      values for a substitute player based on the league's variant. Pure
 *      function; tiny but consumed by lineup UI.
 *
 *   2. `calculateTeamHandicap(homeId, awayId, seasonId, variant)` — async,
 *      DB-dependent. Computes the home team's handicap bonus from match
 *      wins differential. Used by `MatchLineup.tsx` and
 *      `src/hooks/useMatchScoring.ts`. Different from `getTeamHandicapBonus`
 *      (which is points-handicap-specific) — this version takes a variant
 *      and applies a different threshold (2 for 'standard', 3 for
 *      'reduced', 0 for 'none').
 *
 * Both are at risk in the modular-league refactor:
 *   - The variant choice becomes one of the modular preference axes
 *   - The team-bonus formula must produce identical numbers post-refactor
 *
 * `calculateTeamHandicap` queries differently than `getTeamHandicapBonus`:
 * it counts matches where the team is EITHER home or away (and was won
 * by that team), rather than only counting matches between the two
 * specific teams. The two functions are intentionally different and both
 * are consumed in production — locking both protects against either
 * being silently changed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubstituteHandicapOptions } from '../handicapCalculations';

vi.mock('@/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
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
import { calculateTeamHandicap } from '../handicapCalculations';

const HOME = 'home-team-id';
const AWAY = 'away-team-id';
const SEASON = 'season-id';

/**
 * Mock the supabase chain. `calculateTeamHandicap` makes TWO queries —
 * one for home, one for away. Each query: .from().select().eq().or().eq()
 * The final eq returns the data array.
 */
function mockTwoQueries(
  homeMatches: Array<{ winner_team_id: string }>,
  awayMatches: Array<{ winner_team_id: string }>,
  homeError: { message: string } | null = null,
  awayError: { message: string } | null = null
) {
  let callCount = 0;
  vi.mocked(supabase.from).mockImplementation(() => {
    callCount += 1;
    const isHomeQuery = callCount === 1;
    const finalChain = Promise.resolve({
      data: isHomeQuery ? homeMatches : awayMatches,
      error: isHomeQuery ? homeError : awayError,
    }) as any;
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn(() => ({
            eq: vi.fn(() => finalChain),
          })),
        })),
      })),
    } as any;
  });
}

describe('getSubstituteHandicapOptions — characterization', () => {
  it('"standard" variant returns -2..+2 inclusive', () => {
    expect(getSubstituteHandicapOptions('standard')).toEqual([-2, -1, 0, 1, 2]);
  });

  it('"reduced" variant returns -1..+1 inclusive', () => {
    expect(getSubstituteHandicapOptions('reduced')).toEqual([-1, 0, 1]);
  });

  it('"none" variant returns [0] (single zero option)', () => {
    expect(getSubstituteHandicapOptions('none')).toEqual([0]);
  });
});

describe('calculateTeamHandicap — characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('"none" variant short-circuits to 0 (no DB call)', () => {
    it('returns 0 immediately for none variant', async () => {
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'none');
      expect(result).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('"standard" variant: floor((homeWins - awayWins) / 2)', () => {
    it('returns 0 when no matches have been played', async () => {
      mockTwoQueries([], []);
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      expect(result).toBe(0);
    });

    it('returns 0 when home and away have equal wins', async () => {
      mockTwoQueries(
        [{ winner_team_id: HOME }, { winner_team_id: HOME }, { winner_team_id: HOME }],
        [{ winner_team_id: AWAY }, { winner_team_id: AWAY }, { winner_team_id: AWAY }]
      );
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      expect(result).toBe(0);
    });

    it('+1 when home up by 2 (home 4-2)', async () => {
      mockTwoQueries(
        Array(4).fill({ winner_team_id: HOME }),
        Array(2).fill({ winner_team_id: AWAY })
      );
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      expect(result).toBe(1);
    });

    it('+2 when home up by 5 (home 8-3, floor of 2.5)', async () => {
      mockTwoQueries(
        Array(8).fill({ winner_team_id: HOME }),
        Array(3).fill({ winner_team_id: AWAY })
      );
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      expect(result).toBe(2);
    });

    it('+0 when home up by 1 (floor of 0.5)', async () => {
      mockTwoQueries(
        [{ winner_team_id: HOME }, { winner_team_id: HOME }],
        [{ winner_team_id: AWAY }]
      );
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      expect(result).toBe(0);
    });

    it('-2 when away up by 4 (home 3-7)', async () => {
      mockTwoQueries(
        Array(3).fill({ winner_team_id: HOME }),
        Array(7).fill({ winner_team_id: AWAY })
      );
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      expect(result).toBe(-2);
    });

    it('-3 when away up by 5 (home 0-5, floor of -2.5)', async () => {
      mockTwoQueries([], Array(5).fill({ winner_team_id: AWAY }));
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      // (0 - 5) / 2 = -2.5 → floor → -3 (Math.floor rounds toward -Infinity)
      expect(result).toBe(-3);
    });

    it('only counts matches actually won by the team (ignores other winners in the queried set)', async () => {
      // The DB query returns matches where the team is home OR away, but
      // the function filters to actual wins via winner_team_id check.
      mockTwoQueries(
        [
          { winner_team_id: HOME },
          { winner_team_id: 'opponent-x' }, // home team played but lost
          { winner_team_id: HOME },
        ],
        [
          { winner_team_id: AWAY },
          { winner_team_id: 'opponent-y' },
        ]
      );
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      // Home wins: 2, away wins: 1 → diff 1 → floor(0.5) = 0
      expect(result).toBe(0);
    });
  });

  describe('"reduced" variant: floor((homeWins - awayWins) / 3) [different threshold]', () => {
    it('returns 0 when difference is less than 3', async () => {
      mockTwoQueries(
        Array(2).fill({ winner_team_id: HOME }),
        []
      );
      // (2 - 0) / 3 = 0.67 → floor → 0
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'reduced');
      expect(result).toBe(0);
    });

    it('+1 when home up by 3 (home 3-0)', async () => {
      mockTwoQueries(
        Array(3).fill({ winner_team_id: HOME }),
        []
      );
      // (3 - 0) / 3 = 1
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'reduced');
      expect(result).toBe(1);
    });

    it('+1 when home up by 5 (home 5-0, floor of 1.67)', async () => {
      mockTwoQueries(
        Array(5).fill({ winner_team_id: HOME }),
        []
      );
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'reduced');
      expect(result).toBe(1);
    });

    it('+2 when home up by 6 (home 6-0)', async () => {
      mockTwoQueries(
        Array(6).fill({ winner_team_id: HOME }),
        []
      );
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'reduced');
      expect(result).toBe(2);
    });

    it('-1 when away up by 3 (home 0-3)', async () => {
      mockTwoQueries([], Array(3).fill({ winner_team_id: AWAY }));
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'reduced');
      // (0 - 3) / 3 = -1
      expect(result).toBe(-1);
    });
  });

  describe('error handling (defensive 0 default)', () => {
    it('returns 0 when the home query errors', async () => {
      mockTwoQueries([], [], { message: 'home query failed' }, null);
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      expect(result).toBe(0);
    });

    it('returns 0 when the away query errors', async () => {
      mockTwoQueries(
        Array(5).fill({ winner_team_id: HOME }),
        [],
        null,
        { message: 'away query failed' }
      );
      const result = await calculateTeamHandicap(HOME, AWAY, SEASON, 'standard');
      expect(result).toBe(0);
    });
  });
});
