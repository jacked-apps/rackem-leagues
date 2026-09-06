/**
 * @fileoverview Tests for BracketSetupPage — the paid tournament's setup screen.
 *
 * The behaviour that matters here is the Start hand-off: convert the hopper,
 * start the bracket, and only THEN record the charge, so a failed start can
 * never leave a charged-but-not-started tournament.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils';
import type { HopperEntry } from '@/api/queries/brackets';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  bracket: vi.fn(),
  hopper: vi.fn(),
  finalize: vi.fn(),
  start: vi.fn(),
  charge: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ bracketId: 'b1' }),
}));

vi.mock('@/api/hooks/useBrackets', () => {
  // Inline: a vi.mock factory is hoisted above any top-level const it would use.
  const noopMutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useBracket: () => mocks.bracket(),
    useBracketHopper: () => mocks.hopper(),
    useBracketRoster: () => ({ data: [], isLoading: false, isError: false }),
    useFinalizeHopper: () => ({ mutateAsync: mocks.finalize, isPending: false }),
    useStartBracket: () => ({ mutateAsync: mocks.start, isPending: false }),
    useChargeForStart: () => ({ mutateAsync: mocks.charge, isPending: false }),
    useAdmitHopperEntry: noopMutation,
    useSetHopperPaidStatus: noopMutation,
    useEjectHopperEntry: noopMutation,
    useAddRegisteredToHopper: noopMutation,
    useAddWalkupToHopper: noopMutation,
    useForgetRosterEntry: noopMutation,
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: mocks.toastError, info: vi.fn() },
}));

import { BracketSetupPage } from './BracketSetupPage';

function entry(over: Partial<HopperEntry>): HopperEntry {
  return {
    id: 'h1',
    member_id: null,
    display_name: 'Someone',
    status: 'official',
    paid_status: 'unpaid',
    added_via: 'search',
    seed: null,
    created_at: '2026-09-06T00:00:00Z',
    nickname: null,
    first_name: null,
    last_name: null,
    system_player_number: null,
    city: null,
    state: null,
    ...over,
  };
}

/** A paid tournament sitting in setup; `over` tweaks the bracket row. */
function setup(entries: HopperEntry[], over: Record<string, unknown> = {}) {
  mocks.bracket.mockReturnValue({
    data: {
      bracket: {
        id: 'b1',
        name: 'Friday 9-Ball',
        status: 'setup',
        format: 'single_elimination',
        grand_final_reset: true,
        join_token: 'jt-1',
        premium_features: ['real_players'],
        ...over,
      },
      participants: [],
      matches: [],
    },
    isLoading: false,
    isError: false,
  });
  mocks.hopper.mockReturnValue({ data: entries, isLoading: false, isError: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.finalize.mockResolvedValue(4);
  mocks.start.mockResolvedValue(undefined);
  mocks.charge.mockResolvedValue(undefined);
});

describe('BracketSetupPage', () => {
  it('converts, starts, then charges — in that order — and goes to the bracket', async () => {
    const order: string[] = [];
    mocks.finalize.mockImplementation(async () => {
      order.push('finalize');
      return 4;
    });
    mocks.start.mockImplementation(async () => {
      order.push('start');
    });
    mocks.charge.mockImplementation(async () => {
      order.push('charge');
    });

    setup([entry({ id: 'a' }), entry({ id: 'b' })]);
    renderWithProviders(<BracketSetupPage />);

    fireEvent.click(screen.getByRole('button', { name: /Start & pay/ }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/brackets/b1'));
    expect(order).toEqual(['finalize', 'start', 'charge']);
    expect(mocks.finalize).toHaveBeenCalledWith(false);
    expect(mocks.start).toHaveBeenCalledWith(
      expect.objectContaining({ bracketId: 'b1', participantCount: 4 })
    );
  });

  it('passes the organizer\'s waiting-room choice through to the conversion', async () => {
    setup([
      entry({ id: 'a' }),
      entry({ id: 'b' }),
      entry({ id: 'c', status: 'hopper', paid_status: null }),
    ]);
    renderWithProviders(<BracketSetupPage />);

    fireEvent.click(screen.getByLabelText('Also add the 1 still waiting, as unpaid'));
    fireEvent.click(screen.getByRole('button', { name: /Start & pay/ }));

    await waitFor(() => expect(mocks.finalize).toHaveBeenCalledWith(true));
  });

  it('does not charge a tournament with no premium features', async () => {
    setup([entry({ id: 'a' }), entry({ id: 'b' })], { premium_features: [] });
    renderWithProviders(<BracketSetupPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Start tournament' }));

    await waitFor(() => expect(mocks.start).toHaveBeenCalled());
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it('never charges when the start itself fails', async () => {
    mocks.start.mockRejectedValue(new Error('Add at least 2 players before starting'));
    setup([entry({ id: 'a' }), entry({ id: 'b' })]);
    renderWithProviders(<BracketSetupPage />);

    fireEvent.click(screen.getByRole('button', { name: /Start & pay/ }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('Add at least 2 players before starting')
    );
    expect(mocks.charge).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('sends an already-started tournament to its bracket instead of the setup screen', () => {
    setup([], { status: 'live' });
    renderWithProviders(<BracketSetupPage />);

    expect(screen.getByText(/already started/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Start/ })).toBeNull();
  });
});
