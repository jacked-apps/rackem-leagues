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
  auditMatchScoringConsistency: vi.fn(() => Promise.resolve()),
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
import { auditMatchScoringConsistency } from '@/api/queries/matches';
import {
  loSaveLineups,
  loSetupMatch,
  loScoreGame,
  loFinalizeMatch,
} from '../loManualScoring';

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

/** Configure supabase.from for loScoreGame: 'matches' status read + 'match_games' update. */
function mockScoreGame(status: string, updateError: { message: string } | null = null) {
  const gameUpdate = vi.fn(() => ({
    eq: () => Promise.resolve({ error: updateError }),
  }));
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'matches') {
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: { status }, error: null }) }),
        }),
      } as never;
    }
    return { update: gameUpdate } as never; // match_games
  });
  return gameUpdate;
}

/** Configure supabase.from for loFinalizeMatch: 'matches' read+update + 'match_games' read. */
function mockFinalize(opts: {
  matchRow: Record<string, unknown>;
  games: Array<Record<string, unknown>>;
  completeError?: { message: string } | null;
}) {
  const matchUpdate = vi.fn(() => ({
    eq: () => Promise.resolve({ error: opts.completeError ?? null }),
  }));
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'matches') {
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: opts.matchRow, error: null }) }),
        }),
        update: matchUpdate,
      } as never;
    }
    // match_games read
    return {
      select: () => ({ eq: () => Promise.resolve({ data: opts.games, error: null }) }),
    } as never;
  });
  return matchUpdate;
}

const SCORED_GAME = {
  winner_player_id: 'p1',
  confirmed_by_home: 'lo',
  confirmed_by_away: 'lo',
  is_tiebreaker: false,
};

describe('loScoreGame', () => {
  const result = {
    winnerTeamId: HOME,
    winnerPlayerId: 'p1',
    breakAndRun: true,
    winnerValue: 7,
  };

  it('writes both confirmation slots + extras, then recomputes totals', async () => {
    const gameUpdate = mockScoreGame('in_progress');

    await loScoreGame({ matchId: MATCH, gameId: 'g1', loMemberId: 'lo', result });

    const payload = gameUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      winner_team_id: HOME,
      winner_player_id: 'p1',
      break_and_run: true,
      golden_break: false,
      winner_value: 7,
      confirmed_by_home: 'lo',
      confirmed_by_away: 'lo',
    });
    const { updateMatchRunningTotals } = await import('@/api/queries/matches');
    expect(updateMatchRunningTotals).toHaveBeenCalledWith(MATCH);
  });

  it('rejects scoring on a completed match (R9 post-finalize guard)', async () => {
    const gameUpdate = mockScoreGame('completed');
    await expect(
      loScoreGame({ matchId: MATCH, gameId: 'g1', loMemberId: 'lo', result })
    ).rejects.toThrow(/Cannot score a game/);
    expect(gameUpdate).not.toHaveBeenCalled();
  });

  it('rejects scoring on a not-yet-set-up match', async () => {
    mockScoreGame('scheduled');
    await expect(
      loScoreGame({ matchId: MATCH, gameId: 'g1', loMemberId: 'lo', result })
    ).rejects.toThrow(/status 'scheduled'/);
  });
});

describe('loFinalizeMatch', () => {
  const pointsRow = {
    status: 'in_progress',
    home_team_id: HOME,
    away_team_id: AWAY,
    home_points_earned: 10,
    away_points_earned: 5,
    home_games_won: 3,
    away_games_won: 2,
    home_to_win: null,
    away_to_win: null,
    home_to_tie: null,
    away_to_tie: null,
  };

  it('points-mode happy path: completes, fills both verify slots, fires audit', async () => {
    const matchUpdate = mockFinalize({ matchRow: pointsRow, games: [SCORED_GAME] });

    const out = await loFinalizeMatch({ matchId: MATCH, loMemberId: 'lo', winCondition: 'points' });

    expect(out).toEqual({ winnerTeamId: HOME, result: 'home_win' });
    const updates = matchUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updates).toMatchObject({
      home_team_verified_by: 'lo',
      away_team_verified_by: 'lo',
      winner_team_id: HOME,
      match_result: 'home_win',
      status: 'completed',
    });
    expect(auditMatchScoringConsistency).toHaveBeenCalledWith(MATCH);
  });

  it('games-mode happy path: determineMatchResult drives the winner', async () => {
    const gamesRow = {
      ...pointsRow,
      home_games_won: 5,
      away_games_won: 3,
      home_to_win: 5,
      away_to_win: 5,
      home_to_tie: 4,
      away_to_tie: 4,
    };
    const matchUpdate = mockFinalize({ matchRow: gamesRow, games: [SCORED_GAME] });

    const out = await loFinalizeMatch({ matchId: MATCH, loMemberId: 'lo', winCondition: 'games' });

    expect(out.result).toBe('home_win');
    expect((matchUpdate.mock.calls[0][0] as Record<string, unknown>).status).toBe('completed');
  });

  it('games-mode tie is BLOCKED — no completion write', async () => {
    const tieRow = {
      ...pointsRow,
      home_games_won: 4,
      away_games_won: 4,
      home_to_win: 5,
      away_to_win: 5,
      home_to_tie: 4,
      away_to_tie: 4,
    };
    const matchUpdate = mockFinalize({ matchRow: tieRow, games: [SCORED_GAME] });

    await expect(
      loFinalizeMatch({ matchId: MATCH, loMemberId: 'lo', winCondition: 'games' })
    ).rejects.toThrow(/tie that would require a tiebreaker/);
    expect(matchUpdate).not.toHaveBeenCalled();
    expect(auditMatchScoringConsistency).not.toHaveBeenCalled();
  });

  it('blocks finalize when a game is unscored', async () => {
    const unscored = { ...SCORED_GAME, confirmed_by_away: null };
    const matchUpdate = mockFinalize({ matchRow: pointsRow, games: [SCORED_GAME, unscored] });

    await expect(
      loFinalizeMatch({ matchId: MATCH, loMemberId: 'lo', winCondition: 'points' })
    ).rejects.toThrow(/not yet scored/);
    expect(matchUpdate).not.toHaveBeenCalled();
  });

  it('refuses to finalize a match that is not in progress', async () => {
    mockFinalize({ matchRow: { ...pointsRow, status: 'completed' }, games: [SCORED_GAME] });
    await expect(
      loFinalizeMatch({ matchId: MATCH, loMemberId: 'lo', winCondition: 'points' })
    ).rejects.toThrow(/Cannot finalize/);
  });
});
