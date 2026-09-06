/**
 * @fileoverview Tests for the My Stats page.
 *
 * The states matter more than the numbers here — the maths has its own tests.
 * What this guards is that an empty history reads as "you haven't played yet"
 * rather than as a wall of zeroes that looks like a failure, and that a real
 * failure says so instead of silently showing an empty record.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import type { PlayerGameRow } from '@/stats/playerGameRow';

const mockUseHistory = vi.fn();
vi.mock('@/api/hooks/usePlayerGameHistory', () => ({
  usePlayerGameHistory: () => mockUseHistory(),
}));

import { PlayerStats } from '../PlayerStats';

function row(overrides: Partial<PlayerGameRow> = {}): PlayerGameRow {
  return {
    gameId: 'g1',
    matchId: 'm1',
    gameNumber: 1,
    playedOn: '2026-05-01',
    seasonId: 's1',
    won: true,
    ending: 'break_and_run',
    gameType: 'eight_ball',
    opponentId: 'opp',
    opponentName: 'Joe Smith',
    opponentHandicap: 620,
    handicapSystem: 'fargo',
    venueName: 'Butera Billiards',
    tableNumber: 2,
    myTeamId: 'team-1',
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('PlayerStats — states', () => {
  it('says it is loading rather than showing an empty record', () => {
    mockUseHistory.mockReturnValue({ isLoading: true, isError: false });
    renderWithProviders(<PlayerStats />);
    expect(screen.getByText(/loading your games/i)).toBeInTheDocument();
  });

  it('surfaces a failure instead of pretending there are no games', () => {
    mockUseHistory.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('network is down'),
    });
    renderWithProviders(<PlayerStats />);
    expect(screen.getByText(/could not load your games/i)).toBeInTheDocument();
    expect(screen.getByText(/network is down/i)).toBeInTheDocument();
  });

  it('tells a new player they have not played yet', () => {
    // Zeroes everywhere would read as a broken page to someone whose record is
    // genuinely empty.
    mockUseHistory.mockReturnValue({ isLoading: false, isError: false, data: [] });
    renderWithProviders(<PlayerStats />);
    expect(screen.getByText(/no games yet/i)).toBeInTheDocument();
  });
});

describe('PlayerStats — with games', () => {
  beforeEach(() => {
    mockUseHistory.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        row({ gameId: 'a', won: true, ending: 'break_and_run' }),
        row({ gameId: 'b', won: false, ending: 'break_and_run' }),
        row({ gameId: 'c', won: false, ending: 'plain' }),
      ],
    });
  });

  it('shows the record', () => {
    renderWithProviders(<PlayerStats />);
    expect(screen.getByText('Games played')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('breaks endings down in both directions', () => {
    renderWithProviders(<PlayerStats />);
    expect(screen.getByText('Won with')).toBeInTheDocument();
    expect(screen.getByText('Lost to')).toBeInTheDocument();
    // Appears in the breakdown AND on each matching row of the log below, so
    // this asserts presence rather than uniqueness.
    expect(screen.getAllByText('Break & run').length).toBeGreaterThan(0);
  });

  it('shows the game log', () => {
    // Row CONTENT is asserted in GameLogTable's own tests, which stub the
    // element measurements the virtualiser needs. Here we only care that the
    // page hands the log its filtered rows and it reports the right total.
    renderWithProviders(<PlayerStats />);
    expect(screen.getByText('Every game (3)')).toBeInTheDocument();
  });
});
