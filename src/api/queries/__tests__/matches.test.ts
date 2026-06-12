/**
 * @fileoverview Tests for the "My Match" team-scoped detection query
 * (`getMyMatchMatches`) — Unit 1 of the live-match jump-in plan
 * (docs/plans/2026-05-29-002-feat-my-match-jump-in-plan.md).
 *
 * These tests pass a mocked Supabase client (no real DB) and lock the
 * detection contract the rest of the feature depends on:
 *   - team-scoping: only matches where the member is on the home OR away
 *     roster are requested (the `.or(...)` filter)
 *   - status-scoping: only `in_progress` + `scheduled` are requested (the
 *     `.in('status', ...)` filter — this is what excludes completed /
 *     forfeited / updating / postponed)
 *   - date threshold (applied client-side): live matches always pass;
 *     `scheduled` matches pass only when on/before today, so future-scheduled
 *     drops out while today's match and past-due makeups stay
 *   - short-circuits: null/empty memberId and no-team members never hit the
 *     matches table
 *   - error propagation from each query step
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatLocalDate } from '@/utils/formatters';

// Hoisted mock so the `supabase` import inside matches.ts picks up our stub.
const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  },
}));

vi.mock('@/supabaseClient', () => ({
  supabase: supabaseMock,
}));

import { getMyMatchMatches } from '../matches';

/**
 * Build an ISO `YYYY-MM-DD` string offset from today by `days`, using the same
 * local-date arithmetic as the production code so the comparison is stable
 * across timezones and DST boundaries.
 */
function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

const TODAY = formatLocalDate(new Date());
const YESTERDAY = isoOffset(-1);
const TOMORROW = isoOffset(1);

/** A Supabase-shaped match row (pre-hoist: scheduled_date lives on season_week). */
function matchRow(overrides: Record<string, any> = {}) {
  return {
    id: 'm-default',
    status: 'in_progress',
    started_at: '2026-06-12T19:00:00Z',
    home_team_id: 't1',
    away_team_id: 't2',
    home_games_won: 0,
    away_games_won: 0,
    home_team: { id: 't1', team_name: 'Sharks' },
    away_team: { id: 't2', team_name: 'Cues' },
    season_week: { scheduled_date: TODAY },
    ...overrides,
  };
}

/**
 * Wire the two-step query: `team_players` (select → eq) then `matches`
 * (select → or → in). Returns the inner mocks so tests can assert the exact
 * team- and status-scoping that was requested.
 */
function setup(opts: {
  teamRows?: any[];
  teamErr?: any;
  matchRows?: any[];
  matchErr?: any;
} = {}) {
  const { teamRows = [{ team_id: 't1' }], teamErr = null, matchRows = [], matchErr = null } = opts;

  const teamEq = vi.fn().mockResolvedValue({ data: teamRows, error: teamErr });
  const teamSelect = vi.fn().mockReturnValue({ eq: teamEq });

  const inMock = vi.fn().mockResolvedValue({ data: matchRows, error: matchErr });
  const orMock = vi.fn().mockReturnValue({ in: inMock });
  const matchesSelect = vi.fn().mockReturnValue({ or: orMock });

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'team_players') return { select: teamSelect };
    if (table === 'matches') return { select: matchesSelect };
    throw new Error(`unexpected table: ${table}`);
  });

  return { teamEq, orMock, inMock };
}

describe('getMyMatchMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('short-circuits (no DB call)', () => {
    it('returns [] for an empty memberId without querying', async () => {
      setup();
      const result = await getMyMatchMatches('');
      expect(result).toEqual([]);
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('returns [] for a null/undefined memberId without querying', async () => {
      setup();
      // @ts-expect-error — exercising the runtime guard for callers that pass null
      const result = await getMyMatchMatches(null);
      expect(result).toEqual([]);
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('returns [] when the member is on no teams, without touching matches', async () => {
      setup({ teamRows: [] });
      const result = await getMyMatchMatches('member-1');
      expect(result).toEqual([]);
      expect(supabaseMock.from).toHaveBeenCalledWith('team_players');
      expect(supabaseMock.from).not.toHaveBeenCalledWith('matches');
    });
  });

  describe('happy path', () => {
    it('returns a single in_progress match the member is rostered on', async () => {
      setup({ matchRows: [matchRow({ id: 'm1', status: 'in_progress' })] });
      const result = await getMyMatchMatches('member-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m1');
    });

    it("returns today's scheduled match", async () => {
      setup({
        matchRows: [matchRow({ id: 'm-today', status: 'scheduled', season_week: { scheduled_date: TODAY } })],
      });
      const result = await getMyMatchMatches('member-1');
      expect(result.map((m) => m.id)).toEqual(['m-today']);
    });

    it('returns a past-due (makeup) scheduled match', async () => {
      setup({
        matchRows: [matchRow({ id: 'm-makeup', status: 'scheduled', season_week: { scheduled_date: YESTERDAY } })],
      });
      const result = await getMyMatchMatches('member-1');
      expect(result.map((m) => m.id)).toEqual(['m-makeup']);
    });

    it('hoists scheduled_date from season_week onto the row', async () => {
      setup({
        matchRows: [matchRow({ id: 'm1', status: 'scheduled', season_week: { scheduled_date: TODAY } })],
      });
      const result = await getMyMatchMatches('member-1');
      expect(result[0].scheduled_date).toBe(TODAY);
    });
  });

  describe('date threshold (client-side)', () => {
    it('excludes a future-scheduled match', async () => {
      setup({
        matchRows: [matchRow({ id: 'm-future', status: 'scheduled', season_week: { scheduled_date: TOMORROW } })],
      });
      const result = await getMyMatchMatches('member-1');
      expect(result).toEqual([]);
    });

    it('keeps an in_progress match even with a future/missing scheduled_date', async () => {
      setup({
        matchRows: [matchRow({ id: 'm-live', status: 'in_progress', season_week: { scheduled_date: null } })],
      });
      const result = await getMyMatchMatches('member-1');
      expect(result.map((m) => m.id)).toEqual(['m-live']);
    });
  });

  describe('multi-match', () => {
    it('returns both when the member has two in_progress matches', async () => {
      setup({
        teamRows: [{ team_id: 't1' }, { team_id: 't3' }],
        matchRows: [
          matchRow({ id: 'm1', status: 'in_progress' }),
          matchRow({ id: 'm2', status: 'in_progress' }),
        ],
      });
      const result = await getMyMatchMatches('member-1');
      expect(result.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
    });

    it('returns a match once even if the member is on both of its teams', async () => {
      // PostgREST returns the row once; the mapper must not duplicate it.
      setup({ matchRows: [matchRow({ id: 'm-dup', status: 'in_progress' })] });
      const result = await getMyMatchMatches('member-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('query scoping (exclusions enforced at the DB layer)', () => {
    it("scopes to the member's teams on either side (home OR away)", async () => {
      const { orMock } = setup({ teamRows: [{ team_id: 't1' }, { team_id: 't9' }] });
      await getMyMatchMatches('member-1');
      expect(orMock).toHaveBeenCalledWith('home_team_id.in.(t1,t9),away_team_id.in.(t1,t9)');
    });

    it('requests only in_progress + scheduled statuses (excludes completed/forfeited/updating/postponed)', async () => {
      const { inMock } = setup();
      await getMyMatchMatches('member-1');
      expect(inMock).toHaveBeenCalledWith('status', ['in_progress', 'scheduled']);
    });

    it('dedupes the resolved team IDs before building the filter', async () => {
      const { orMock } = setup({ teamRows: [{ team_id: 't1' }, { team_id: 't1' }] });
      await getMyMatchMatches('member-1');
      expect(orMock).toHaveBeenCalledWith('home_team_id.in.(t1),away_team_id.in.(t1)');
    });
  });

  describe('error propagation', () => {
    it('throws when the team_players step errors', async () => {
      setup({ teamErr: { message: 'team_players boom' } });
      await expect(getMyMatchMatches('member-1')).rejects.toThrow(/team_players boom/);
    });

    it('throws when the matches step errors', async () => {
      setup({ matchErr: { message: 'matches boom' } });
      await expect(getMyMatchMatches('member-1')).rejects.toThrow(/matches boom/);
    });
  });
});
