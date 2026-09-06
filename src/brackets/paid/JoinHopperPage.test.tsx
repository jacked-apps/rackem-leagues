/**
 * @fileoverview Tests for JoinHopperPage — the player's live tournament page.
 *
 * Two things carry the feature: the COLD SCANNER must come back here after
 * signing in (lose the intent and the code on the wall silently does nothing),
 * and the page must be a live view rather than a one-shot "you're in" that
 * never changes again.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import type { BracketPlayerView } from '@/api/queries/brackets';

const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  join: vi.fn(),
  view: vi.fn(),
  realtime: vi.fn(),
}));
const joinState = vi.hoisted(() => ({ data: undefined as unknown }));

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useParams: () => ({ joinToken: 'jt-1' }),
  useLocation: () => ({ pathname: '/brackets/join/jt-1', search: '', state: null }),
}));

vi.mock('@/api/hooks/useCurrentMember', () => ({
  useCurrentMember: () => mocks.member(),
}));

vi.mock('@/api/hooks/useBrackets', () => ({
  useJoinHopper: () => ({ mutate: mocks.join, data: joinState.data, isPending: false }),
  useBracketPlayerView: () => mocks.view(),
}));

vi.mock('../useBracketRealtime', () => ({
  useBracketRealtime: (...args: unknown[]) => mocks.realtime(...args),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { JoinHopperPage } from './JoinHopperPage';

function playerView(over: Partial<BracketPlayerView> = {}): BracketPlayerView {
  return {
    found: true,
    bracket: {
      id: 'b1',
      name: 'Friday 9-Ball',
      status: 'setup',
      format: 'double_elimination',
      grand_final_reset: false,
      game_type: null,
      premium_features: ['real_players'],
    },
    waiting: ['Slim'],
    official: ['Mike'],
    me: null,
    participants: [],
    matches: [],
    ...over,
  };
}

function loaded(over: Partial<BracketPlayerView> = {}) {
  mocks.view.mockReturnValue({ data: playerView(over), isLoading: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  joinState.data = undefined;
  mocks.member.mockReturnValue({ data: { id: 'm1' }, isLoading: false });
  loaded();
});

describe('JoinHopperPage', () => {
  it('lands on the live tournament, not a dead-end confirmation', () => {
    loaded();
    renderWithProviders(<JoinHopperPage />);

    expect(screen.getByText('Friday 9-Ball')).toBeTruthy();
    expect(screen.getByText('In the tournament (1)')).toBeTruthy();
    expect(screen.getByText('Waiting to be added (1)')).toBeTruthy();
  });

  it('watches the hopper live, since the point is seeing the room fill up', () => {
    loaded();
    renderWithProviders(<JoinHopperPage />);

    const [bracketId, , watchHopper] = mocks.realtime.mock.calls[0];
    expect(bracketId).toBe('b1');
    expect(watchHopper).toBe(true);
  });

  it('joins a signed-in player who is not on the list yet', () => {
    loaded({ me: null });
    renderWithProviders(<JoinHopperPage />);

    expect(mocks.join).toHaveBeenCalledWith(
      { joinToken: 'jt-1' },
      expect.anything()
    );
  });

  it('does not re-join someone already on the list', () => {
    loaded({ me: { display_name: 'Tim P', status: 'hopper', paid_status: null } });
    renderWithProviders(<JoinHopperPage />);

    expect(mocks.join).not.toHaveBeenCalled();
  });

  it('shows the tournament to a signed-out visitor and offers sign-in that returns here', () => {
    mocks.member.mockReturnValue({ data: null, isLoading: false });
    loaded();
    renderWithProviders(<JoinHopperPage />);

    // Anon can watch — the read is names-only.
    expect(screen.getByText('In the tournament (1)')).toBeTruthy();
    expect(mocks.join).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: /sign in/i }).getAttribute('href')
    ).toBe('/login?redirect=%2Fbrackets%2Fjoin%2Fjt-1');
  });

  it('offers no Bracket tab before the tournament starts', () => {
    loaded();
    renderWithProviders(<JoinHopperPage />);
    expect(screen.queryByRole('tab', { name: /bracket/i })).toBeNull();
  });

  it('adds the Bracket tab once there is a bracket to look at', () => {
    loaded({
      bracket: { ...playerView().bracket!, status: 'live' },
      participants: [
        { id: 'p1', bracket_id: 'b1', display_name: 'Mike', seed: 1 },
        { id: 'p2', bracket_id: 'b1', display_name: 'Sara', seed: 2 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      matches: [
        {
          id: 'm1',
          bracket_id: 'b1',
          round: 1,
          side: 'winners',
          slot: 0,
          home_participant_id: 'p1',
          away_participant_id: 'p2',
          winner_participant_id: null,
          status: 'ready',
          in_progress: false,
          is_reset_match: false,
          next_match_id: null,
          next_match_slot: null,
          loser_next_match_id: null,
          loser_next_match_slot: null,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
    });
    renderWithProviders(<JoinHopperPage />);

    expect(screen.getByRole('tab', { name: /bracket/i })).toBeTruthy();
  });

  it('sends a player whose name is taken to their profile', () => {
    joinState.data = { ok: false, reason: 'name_taken', name: 'Tim P' };
    loaded();
    renderWithProviders(<JoinHopperPage />);

    expect(screen.getByText(/that name's taken/i)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /change my nickname/i }).getAttribute('href')
    ).toBe('/profile');
  });

  it('reports an invalid link rather than an empty tournament', () => {
    mocks.view.mockReturnValue({ data: { found: false }, isLoading: false });
    renderWithProviders(<JoinHopperPage />);

    expect(screen.getByText(/link not valid/i)).toBeTruthy();
  });
});
