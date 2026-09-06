/**
 * @fileoverview Tests for JoinHopperPage — the player's live tournament page.
 *
 * Two things carry the feature: the COLD SCANNER must come back here after
 * signing in (lose the intent and the code on the wall silently does nothing),
 * and the page must be a live view rather than a one-shot "you're in" that
 * never changes again.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
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

const addSelf = vi.hoisted(() => vi.fn());
vi.mock('@/api/hooks/useBrackets', () => ({
  useJoinHopper: () => ({ mutate: mocks.join, data: joinState.data, isPending: false }),
  useBracketPlayerView: () => mocks.view(),
  useAddSelfAsWalkup: () => ({ mutateAsync: addSelf, isPending: false }),
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

function loaded(over: Partial<BracketPlayerView> = {}, isFetching = false) {
  mocks.view.mockReturnValue({ data: playerView(over), isLoading: false, isFetching });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  addSelf.mockResolvedValue({ ok: true, name: 'Rocket' });
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
    expect(screen.getByText('Waiting (1)')).toBeTruthy();
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

  it('gives a signed-out visitor both doors: type a name or sign in', () => {
    mocks.member.mockReturnValue({ data: null, isLoading: false });
    loaded();
    renderWithProviders(<JoinHopperPage />);

    // Anon can watch — the read is names-only.
    expect(screen.getByText('In the tournament (1)')).toBeTruthy();
    expect(mocks.join).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/play as a guest/i)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /sign in/i }).getAttribute('href')
    ).toBe('/login?redirect=%2Fbrackets%2Fjoin%2Fjt-1');
  });

  it('shows the Bracket tab before there is a bracket, flagged as not ready', () => {
    // A tab that materialises later teaches nobody the shape of the page.
    loaded();
    renderWithProviders(<JoinHopperPage />);
    expect(screen.getByRole('tab', { name: /bracket · not ready/i })).toBeTruthy();
  });

  it('explains the empty Bracket tab rather than showing nothing', async () => {
    const user = userEvent.setup();
    loaded();
    renderWithProviders(<JoinHopperPage />);

    await user.click(screen.getByRole('tab', { name: /bracket/i }));
    expect(await screen.findByText(/bracket isn't ready yet/i)).toBeTruthy();
  });

  it('puts the tournament rules under the name, not below the player lists', () => {
    loaded();
    renderWithProviders(<JoinHopperPage />);
    expect(screen.getByText('Double elimination')).toBeTruthy();
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

    // Once a bracket exists the tab drops its "not ready" note.
    expect(screen.getByRole('tab', { name: /^bracket$/i })).toBeTruthy();
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

  describe('a walk-up who typed a name', () => {
    it('remembers them on return and stops offering the box again', () => {
      mocks.member.mockReturnValue({ data: null, isLoading: false });
      localStorage.setItem('bracket-walkup:jt-1', 'Rocket');
      loaded({ waiting: ['Rocket'] });
      renderWithProviders(<JoinHopperPage />);

      expect(screen.getByText(/you're on the waiting list as rocket/i)).toBeTruthy();
      expect(screen.queryByLabelText(/play as a guest/i)).toBeNull();
    });

    it('does not carry the name to a different tournament', () => {
      mocks.member.mockReturnValue({ data: null, isLoading: false });
      // A note left on another tournament must not identify them here.
      localStorage.setItem('bracket-walkup:jt-OTHER', 'Rocket');
      loaded({ waiting: ['Rocket'] });
      renderWithProviders(<JoinHopperPage />);

      expect(screen.getByLabelText(/play as a guest/i)).toBeTruthy();
    });

    it('drops a remembered name the organizer has removed', () => {
      mocks.member.mockReturnValue({ data: null, isLoading: false });
      localStorage.setItem('bracket-walkup:jt-1', 'Rocket');
      // Rocket is not on the live list any more — the note is stale.
      loaded({ waiting: ['Slim'], official: ['Mike'] });
      renderWithProviders(<JoinHopperPage />);

      expect(screen.getByLabelText(/play as a guest/i)).toBeTruthy();
      expect(localStorage.getItem('bracket-walkup:jt-1')).toBeNull();
    });

    it('replaces the box with their standing the moment the name is added', async () => {
      const user = userEvent.setup();
      mocks.member.mockReturnValue({ data: null, isLoading: false });
      loaded();
      // The refetched list now contains them, as it would after invalidation.
      addSelf.mockImplementation(async () => {
        loaded({ waiting: ['Rocket'] });
        return { ok: true, name: 'Rocket' };
      });
      renderWithProviders(<JoinHopperPage />);

      await user.type(screen.getByLabelText(/play as a guest/i), 'Rocket');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      // Storage writes don't re-render on their own — the name is held in state.
      expect(await screen.findByText(/you're on the waiting list as rocket/i)).toBeTruthy();
      expect(screen.queryByLabelText(/play as a guest/i)).toBeNull();
    });

    it('keeps the remembered name while the list is still refetching', () => {
      mocks.member.mockReturnValue({ data: null, isLoading: false });
      localStorage.setItem('bracket-walkup:jt-1', 'Rocket');
      // Mid-refetch the list is stale and does NOT yet contain them. Treating
      // that as "removed" erased a name that had just been added successfully.
      loaded({ waiting: ['Slim'], official: [] }, true);
      renderWithProviders(<JoinHopperPage />);

      expect(localStorage.getItem('bracket-walkup:jt-1')).toBe('Rocket');
    });
  });
});
