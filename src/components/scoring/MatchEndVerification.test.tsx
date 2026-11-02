/**
 * @fileoverview MatchEndVerification: who gets the "Verify Scores" button.
 *
 * Only the two teams playing may verify (LIST_FOR_ED #38). Callers pass
 * `onVerify` for a viewer on one of the teams and leave it out for anyone
 * else (spectators, players from other matches). Without it the button is
 * hidden but both teams' verified / waiting status still shows.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MatchEndVerification } from './MatchEndVerification';

// Data hooks return "nothing loaded yet": the verify row only needs props.
vi.mock('@/api/hooks/useMatches', () => ({
  useMatchGames: () => ({ data: [], isLoading: false }),
  useMatchWithLeagueSettings: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('@/api/hooks/useMatchMutations', () => ({
  useCreateMatchGames: () => ({ mutateAsync: vi.fn() }),
  useUpdateMatch: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/api/hooks/useResolvedLeaguePrefs', () => ({
  useResolvedLeaguePrefs: () => ({ data: undefined }),
}));
vi.mock('@/api/queries/tiebreakers', () => ({
  getMatchTiebreaker: vi.fn().mockResolvedValue(null),
}));

const baseProps = {
  matchId: 'm1',
  homeTeamId: 'h',
  awayTeamId: 'a',
  homeTeamName: 'Home Team',
  awayTeamName: 'Away Team',
  homeWins: 10,
  awayWins: 5,
  homeWinThreshold: 9,
  awayWinThreshold: 9,
  homeTieThreshold: 8,
  awayTieThreshold: 8,
  homeVerifiedBy: null,
  awayVerifiedBy: null,
  isHomeTeam: true,
  gameType: 'eight_ball',
};

function renderIt(extra: Partial<Parameters<typeof MatchEndVerification>[0]>) {
  return render(
    <MemoryRouter>
      <MatchEndVerification {...baseProps} {...extra} />
    </MemoryRouter>
  );
}

describe('MatchEndVerification — Verify button audience', () => {
  it('shows the Verify button to a player on one of the teams', () => {
    renderIt({ onVerify: vi.fn() });
    expect(screen.getByRole('button', { name: 'Verify Scores' })).toBeTruthy();
  });

  it('hides the Verify button when onVerify is left out (not on either team)', () => {
    renderIt({});
    expect(screen.queryByRole('button', { name: /verify/i })).toBeNull();
    // Status for both teams is still visible to the onlooker.
    expect(screen.getByText(/Home: /)).toBeTruthy();
    expect(screen.getByText(/Away: /)).toBeTruthy();
  });
});
