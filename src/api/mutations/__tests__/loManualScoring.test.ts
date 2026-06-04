/**
 * @fileoverview Unit tests for the LO manual-scoring data layer (Unit 2):
 * `loSaveLineups` + `loSetupMatch`. Orchestration only — the supabase client
 * and the called helpers/queries are mocked. The real DB round-trip is Unit 7.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('@/api/queries/matches', () => ({
  populateMatchSnapshotIfNeeded: vi.fn(async () => {}),
  updateMatchRunningTotals: vi.fn(async () => {}),
}));
vi.mock('@/utils/match/computeMatchPrepPayload', () => ({
  computeMatchPrepPayload: vi.fn(async () => ({
    thresholds: {
      home_to_win: 5,
      home_to_tie: 0,
      home_to_lose: null,
      away_to_win: 5,
      away_to_tie: 0,
      away_to_lose: null,
    },
    gameRows: [{ game_number: 1 }],
  })),
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { supabase } from '@/supabaseClient';
import {
  populateMatchSnapshotIfNeeded,
  updateMatchRunningTotals,
} from '@/api/queries/matches';
import { computeMatchPrepPayload } from '@/utils/match/computeMatchPrepPayload';
import { loSaveLineups, loSetupMatch } from '../loManualScoring';

const MATCH = 'match-1';
const LEAGUE = 'league-1';
const HOME = 'home-team';
const AWAY = 'away-team';

/** A scheduled match row. */
const scheduledMatch = {
  id: MATCH,
  status: 'scheduled',
  home_team_id: HOME,
  away_team_id: AWAY,
  season_id: 'season-1',
};

/** Configure `supabase.from` for loSetupMatch: 'matches' read + 'match_lineups' read. */
function mockSetupReads(match: Record<string, unknown>, lineups: Array<Record<string, unknown>>) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'matches') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: match, error: null }),
          }),
        }),
      } as never;
    }
    // match_lineups read: .select().eq() resolves to the array.
    return {
      select: () => ({
        eq: () => Promise.resolve({ data: lineups, error: null }),
      }),
    } as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.rpc).mockResolvedValue({ error: null } as never);
});

describe('loSaveLineups', () => {
  it('upserts both lineups locked, with overridden handicaps and onConflict', async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await loSaveLineups({
      matchId: MATCH,
      homeTeamId: HOME,
      awayTeamId: AWAY,
      homePlayers: [{ position: 1, playerId: 'h1', handicap: 7 }],
      awayPlayers: [{ position: 1, playerId: 'a1', handicap: 3 }],
      homeTeamModifier: 2,
    });

    expect(supabase.from).toHaveBeenCalledWith('match_lineups');
    expect(upsert).toHaveBeenCalledTimes(2);

    const [homeRow, homeOpts] = upsert.mock.calls[0];
    expect(homeRow).toMatchObject({
      match_id: MATCH,
      team_id: HOME,
      locked: true,
      player1_id: 'h1',
      player1_handicap: 7, // overridden value persisted
      home_team_modifier: 2,
    });
    expect(homeRow).toHaveProperty('locked_at');
    expect(homeOpts).toEqual({ onConflict: 'match_id,team_id' });

    const [awayRow] = upsert.mock.calls[1];
    expect(awayRow).toMatchObject({ team_id: AWAY, player1_handicap: 3, home_team_modifier: 0 });
  });

  it('throws if an upsert fails', async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: { message: 'boom' } }));
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    await expect(
      loSaveLineups({
        matchId: MATCH,
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homePlayers: [{ position: 1, playerId: 'h1', handicap: 7 }],
        awayPlayers: [{ position: 1, playerId: 'a1', handicap: 3 }],
      })
    ).rejects.toThrow(/Failed to save LO lineup/);
  });
});

describe('loSetupMatch', () => {
  const lineups = [
    { team_id: HOME, player1_id: 'h1', player1_handicap: 7 },
    { team_id: AWAY, player1_id: 'a1', player1_handicap: 3 },
  ];

  const setupParams = {
    matchId: MATCH,
    leagueId: LEAGUE,
    lineupSize: 3,
    handicapType: 'fargo',
  };

  it('happy path: payload → prep_match → snapshot → totals, in order', async () => {
    mockSetupReads(scheduledMatch, lineups);

    await loSetupMatch(setupParams);

    expect(computeMatchPrepPayload).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('prep_match', {
      p_match_id: MATCH,
      p_thresholds: expect.objectContaining({ home_to_win: 5 }),
      p_game_rows: [{ game_number: 1 }],
    });
    expect(populateMatchSnapshotIfNeeded).toHaveBeenCalledWith(MATCH, LEAGUE);
    expect(updateMatchRunningTotals).toHaveBeenCalledWith(MATCH);

    // Order: compute payload → rpc → freeze snapshot → seed totals.
    const order = (f: { mock: { invocationCallOrder: number[] } }) => f.mock.invocationCallOrder[0];
    expect(order(vi.mocked(computeMatchPrepPayload))).toBeLessThan(order(vi.mocked(supabase.rpc)));
    expect(order(vi.mocked(supabase.rpc))).toBeLessThan(order(vi.mocked(populateMatchSnapshotIfNeeded)));
    expect(order(vi.mocked(populateMatchSnapshotIfNeeded))).toBeLessThan(
      order(vi.mocked(updateMatchRunningTotals))
    );
  });

  it('R11 guard: refuses a non-scheduled match — no prep_match, no payload', async () => {
    mockSetupReads({ ...scheduledMatch, status: 'in_progress' }, lineups);

    await expect(loSetupMatch(setupParams)).rejects.toThrow(/not eligible for manual setup/);
    expect(computeMatchPrepPayload).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('throws when a lineup is missing (only one side saved)', async () => {
    mockSetupReads(scheduledMatch, [lineups[0]]);

    await expect(loSetupMatch(setupParams)).rejects.toThrow(/Both lineups must be saved/);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('throws when prep_match fails', async () => {
    mockSetupReads(scheduledMatch, lineups);
    vi.mocked(supabase.rpc).mockResolvedValue({ error: { message: 'rpc boom' } } as never);

    await expect(loSetupMatch(setupParams)).rejects.toThrow(/prep_match failed/);
    expect(populateMatchSnapshotIfNeeded).not.toHaveBeenCalled();
  });

  it('setup survives a non-fatal snapshot failure (games already created)', async () => {
    mockSetupReads(scheduledMatch, lineups);
    vi.mocked(populateMatchSnapshotIfNeeded).mockRejectedValueOnce(new Error('snap fail'));

    await expect(loSetupMatch(setupParams)).resolves.toBeUndefined();
    expect(updateMatchRunningTotals).toHaveBeenCalledWith(MATCH);
  });
});
