/**
 * @fileoverview Tests for the LO Setup phase: the pure lineup transforms (the
 * data sent to loSaveLineups + the completeness gate) and a render smoke test.
 * Radix Select interaction is left to manual/integration verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { computeLineupCompleteness } from '@/utils/lineup';

vi.mock('@/api/hooks', () => ({ useTeamDetails: vi.fn() }));
vi.mock('@/api/hooks/usePlayerHandicaps', () => ({ usePlayerHandicaps: vi.fn() }));
vi.mock('@/api/mutations/loManualScoring', () => ({
  loSaveLineups: vi.fn(async () => {}),
  loSetupMatch: vi.fn(async () => {}),
}));

import { useTeamDetails } from '@/api/hooks';
import { usePlayerHandicaps } from '@/api/hooks/usePlayerHandicaps';
import { SetupPhase } from '../SetupPhase';
import { toLineupRow, toLineupPlayers, type SideLineup } from '../lineupTransforms';

const fullSide: SideLineup = {
  1: { playerId: 'p1', handicap: '5' },
  2: { playerId: 'p2', handicap: '6' },
  3: { playerId: 'p3', handicap: '7' },
};

describe('toLineupPlayers', () => {
  it('maps filled positions to {position, playerId, handicap:number}', () => {
    expect(toLineupPlayers(fullSide, 3)).toEqual([
      { position: 1, playerId: 'p1', handicap: 5 },
      { position: 2, playerId: 'p2', handicap: 6 },
      { position: 3, playerId: 'p3', handicap: 7 },
    ]);
  });

  it('skips empty positions', () => {
    expect(toLineupPlayers({ 1: { playerId: 'p1', handicap: '5' } }, 3)).toHaveLength(1);
  });

  it('coerces a blank handicap to 0', () => {
    expect(toLineupPlayers({ 1: { playerId: 'p1', handicap: '' } }, 3)[0].handicap).toBe(0);
  });
});

describe('toLineupRow + completeness gate', () => {
  it('a fully-filled side is complete', () => {
    expect(computeLineupCompleteness(toLineupRow(fullSide, 3), 3).complete).toBe(true);
  });

  it('a side with a missing position is incomplete', () => {
    const partial: SideLineup = { 1: { playerId: 'p1', handicap: '5' } };
    expect(computeLineupCompleteness(toLineupRow(partial, 3), 3).complete).toBe(false);
  });

  it('a selected player with no handicap is incomplete', () => {
    const noHc: SideLineup = {
      1: { playerId: 'p1', handicap: '' },
      2: { playerId: 'p2', handicap: '6' },
      3: { playerId: 'p3', handicap: '7' },
    };
    expect(computeLineupCompleteness(toLineupRow(noHc, 3), 3).complete).toBe(false);
  });
});

describe('SetupPhase render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTeamDetails).mockReturnValue({
      data: {
        team_players: [
          { members: { id: 'p1', nickname: 'Ace', first_name: 'A', last_name: 'One' } },
        ],
      },
    } as never);
    vi.mocked(usePlayerHandicaps).mockReturnValue({
      handicaps: new Map([['p1', { value: 5 }]]),
      isLoading: false,
      errors: null,
    } as never);
  });

  const props = {
    matchId: 'm1',
    leagueId: 'L1',
    homeTeamId: 'H',
    awayTeamId: 'A',
    homeTeamName: 'Sharks',
    awayTeamName: 'Jets',
    lineupSize: 3,
    handicapType: 'points',
    handicapVariant: 'standard' as const,
    gameType: 'eight_ball',
    onSetupComplete: vi.fn(),
  };

  it('renders both team columns with Setup Match disabled until lineups are filled', () => {
    render(<SetupPhase {...props} />);
    expect(screen.getByText('Sharks')).toBeInTheDocument();
    expect(screen.getByText('Jets')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Fill both lineups|Setup Match/ });
    expect(button).toBeDisabled();
  });
});
