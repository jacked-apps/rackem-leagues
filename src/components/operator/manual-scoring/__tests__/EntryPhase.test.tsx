/**
 * @fileoverview Tests for the LO Entry phase: pure grid/finalize helpers and a
 * render smoke test (games render, finalize gated on all-scored, pick buttons
 * present). Radix dialog interaction is left to manual/integration verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  regularGames,
  countUnscored,
  isGameScored,
  winnerWasScheduledBreaker,
  type EntryGame,
} from '../entryHelpers';

vi.mock('@/api/hooks', () => ({
  useMatchWithLeagueSettings: vi.fn(),
  useMatchGames: vi.fn(),
  useTeamDetails: vi.fn(),
}));
vi.mock('@/api/mutations/loManualScoring', () => ({
  loScoreGame: vi.fn(async () => {}),
  loFinalizeMatch: vi.fn(async () => ({ winnerTeamId: 'H', result: 'home_win' })),
}));

import { useMatchWithLeagueSettings, useMatchGames, useTeamDetails } from '@/api/hooks';
import { EntryPhase } from '../EntryPhase';

const game = (over: Partial<EntryGame>): EntryGame => ({
  id: over.id ?? 'g1',
  game_number: over.game_number ?? 1,
  home_player_id: 'h1',
  away_player_id: 'a1',
  home_action: 'breaks',
  away_action: 'racks',
  winner_player_id: null,
  winner_team_id: null,
  ...over,
});

describe('entryHelpers', () => {
  it('regularGames excludes tiebreakers and sorts by number', () => {
    const out = regularGames([
      game({ id: 'b', game_number: 2 }),
      game({ id: 't', game_number: 9, is_tiebreaker: true }),
      game({ id: 'a', game_number: 1 }),
    ]);
    expect(out.map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('countUnscored counts only regular games without a winner', () => {
    expect(
      countUnscored([
        game({ id: '1' }),
        game({ id: '2', winner_player_id: 'h1' }),
        game({ id: 't', is_tiebreaker: true }),
      ])
    ).toBe(1);
  });

  it('isGameScored reflects winner presence', () => {
    expect(isGameScored(game({}))).toBe(false);
    expect(isGameScored(game({ winner_player_id: 'h1' }))).toBe(true);
  });

  it('winnerWasScheduledBreaker reads the winning side action', () => {
    const g = game({ home_action: 'breaks', away_action: 'racks' });
    expect(winnerWasScheduledBreaker(g, true)).toBe(true); // home won, home broke
    expect(winnerWasScheduledBreaker(g, false)).toBe(false); // away won, away racked
  });
});

describe('EntryPhase render', () => {
  const props = {
    matchId: 'm1',
    homeTeamId: 'H',
    awayTeamId: 'A',
    homeTeamName: 'Sharks',
    awayTeamName: 'Jets',
    loMemberId: 'lo',
    winCondition: 'games' as const,
    handicapType: 'points',
    gameType: 'eight_ball',
    goldenBreakCountsAsWin: false,
    onFinalized: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMatchWithLeagueSettings).mockReturnValue({
      data: { home_games_won: 0, away_games_won: 0, home_to_win: 5, away_to_win: 5 },
      refetch: vi.fn(),
    } as never);
    vi.mocked(useTeamDetails).mockReturnValue({
      data: {
        team_players: [
          { members: { id: 'h1', nickname: 'Ace', first_name: 'A', last_name: 'One' } },
          { members: { id: 'a1', nickname: 'Biz', first_name: 'B', last_name: 'Two' } },
        ],
      },
    } as never);
  });

  it('shows pick buttons for an unscored game and disables Finalize', () => {
    vi.mocked(useMatchGames).mockReturnValue({ data: [game({})], refetch: vi.fn() } as never);
    render(<EntryPhase {...props} />);

    expect(screen.getByTestId('pick-home')).toBeInTheDocument();
    expect(screen.getByTestId('pick-away')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not yet scored/ })).toBeDisabled();
  });

  it('shows the winner + edit for a scored game and enables Finalize', () => {
    vi.mocked(useMatchGames).mockReturnValue({
      data: [game({ winner_player_id: 'h1', winner_team_id: 'H' })],
      refetch: vi.fn(),
    } as never);
    render(<EntryPhase {...props} />);

    expect(screen.getByText(/🏆 Ace/)).toBeInTheDocument();
    expect(screen.getByTestId('edit-game')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalize Match' })).toBeEnabled();
  });
});
