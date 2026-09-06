/**
 * @fileoverview Tests for HopperView — the organizer's three-group setup screen.
 *
 * Covers the shape the organizer relies on: a sticky count bar, the three groups
 * stacked in order (in the tournament → waiting → past players) with each
 * player appearing exactly once, the per-group empty copy, and the one-tap add
 * from past players.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, userEvent } from '@/test/utils';
import type { HopperEntry, RosterPlayer } from '@/api/queries/brackets';

const mocks = vi.hoisted(() => ({
  hopper: vi.fn(),
  roster: vi.fn(),
  admit: vi.fn(),
  setPaid: vi.fn(),
  eject: vi.fn(),
  addRegistered: vi.fn(),
  addWalkup: vi.fn(),
  forget: vi.fn(),
}));

/** A mutation hook's return shape — only what HopperView reads. */
function mutation(fn: ReturnType<typeof vi.fn>) {
  return { mutateAsync: fn, isPending: false };
}

vi.mock('@/api/hooks/useBrackets', () => ({
  useBracketHopper: () => mocks.hopper(),
  useBracketRoster: () => mocks.roster(),
  useAdmitHopperEntry: () => mutation(mocks.admit),
  useSetHopperPaidStatus: () => mutation(mocks.setPaid),
  useEjectHopperEntry: () => mutation(mocks.eject),
  useAddRegisteredToHopper: () => mutation(mocks.addRegistered),
  useAddWalkupToHopper: () => mutation(mocks.addWalkup),
  useForgetRosterEntry: () => mutation(mocks.forget),
}));

import { HopperView } from './HopperView';

function entry(over: Partial<HopperEntry>): HopperEntry {
  return {
    id: 'h1',
    member_id: null,
    display_name: 'Someone',
    status: 'hopper',
    paid_status: null,
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

function rosterPlayer(over: Partial<RosterPlayer> = {}): RosterPlayer {
  return {
    member_id: 'm-kenny',
    display_name: null,
    handicap: null,
    nickname: 'Kenny',
    first_name: 'Ken',
    last_name: 'Baker',
    system_player_number: 333,
    city: 'Erie',
    state: 'PA',
    first_seen_at: '2026-08-01T00:00:00Z',
    ...over,
  };
}

/** A remembered walk-up: no account, the name is the whole identity. */
function rememberedWalkup(name: string): RosterPlayer {
  return rosterPlayer({
    member_id: null,
    display_name: name,
    nickname: null,
    first_name: null,
    last_name: null,
    system_player_number: null,
    city: null,
    state: null,
  });
}

/** Point the read hooks at fixed data in their loaded state. */
function loaded(entries: HopperEntry[], roster: RosterPlayer[] = []) {
  mocks.hopper.mockReturnValue({ data: entries, isLoading: false, isError: false });
  mocks.roster.mockReturnValue({ data: roster, isLoading: false, isError: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admit.mockResolvedValue(undefined);
  mocks.setPaid.mockResolvedValue(undefined);
  mocks.eject.mockResolvedValue(undefined);
  mocks.addRegistered.mockResolvedValue({ ok: true });
  mocks.addWalkup.mockResolvedValue(undefined);
  mocks.forget.mockResolvedValue(true);
  loaded([]);
});

describe('HopperView', () => {
  it('shows a count bar and all three group headings', () => {
    loaded(
      [
        entry({ id: 'a', status: 'official', display_name: 'Mike', paid_status: 'paid' }),
        entry({ id: 'b', status: 'hopper', display_name: 'Slim', added_via: 'qr' }),
      ],
      [rosterPlayer()]
    );
    renderWithProviders(<HopperView bracketId="b1" />);

    expect(screen.getByText('In 1')).toBeTruthy();
    expect(screen.getByText('Waiting 1')).toBeTruthy();
    expect(screen.getByText('Past 1')).toBeTruthy();

    expect(screen.getByText('In the tournament (1)')).toBeTruthy();
    expect(screen.getByText('Waiting to be added (1)')).toBeTruthy();
    expect(screen.getByText('Past players (1)')).toBeTruthy();
  });

  it('labels an official entry paid/unpaid and a candidate by how they arrived', () => {
    loaded([
      entry({ id: 'a', status: 'official', display_name: 'Mike', paid_status: 'unpaid' }),
      entry({ id: 'b', status: 'hopper', display_name: 'Slim', added_via: 'qr' }),
      entry({ id: 'c', status: 'hopper', display_name: 'Doc', added_via: 'link' }),
    ]);
    renderWithProviders(<HopperView bracketId="b1" trackEntryFees />);

    expect(screen.getByText('Unpaid')).toBeTruthy();
    expect(screen.getByText('Scanned in')).toBeTruthy();
    expect(screen.getByText('Joined by link')).toBeTruthy();
  });

  it('shows a registered player nickname-first with their number and home', () => {
    loaded([
      entry({
        id: 'a',
        member_id: 'm9',
        display_name: 'William Stone',
        nickname: 'Slim',
        system_player_number: 1042,
        city: 'Buffalo',
        state: 'NY',
      }),
    ]);
    renderWithProviders(<HopperView bracketId="b1" />);

    expect(screen.getByText('Slim')).toBeTruthy();
    expect(screen.getByText('#1042 · Buffalo, NY')).toBeTruthy();
  });

  it('warns when two players share a name and nothing tells them apart', () => {
    loaded([
      entry({ id: 'a', display_name: 'Slim' }),
      entry({ id: 'b', display_name: 'slim' }),
    ]);
    renderWithProviders(<HopperView bracketId="b1" />);

    expect(screen.getAllByText(/same name as another player/i).length).toBe(2);
  });

  it('adds a past player from their menu', async () => {
    const user = userEvent.setup();
    loaded([], [rosterPlayer()]);
    renderWithProviders(<HopperView bracketId="b1" />);

    await user.click(screen.getByRole('button', { name: /Kenny/ }));
    await user.click(await screen.findByText('Add to this tournament'));

    // Only the id — the server derives the name, so a player enters under the
    // same name however they got there.
    expect(mocks.addRegistered).toHaveBeenCalledWith('m-kenny');
  });

  it('forgets a registered past player by member id', async () => {
    const user = userEvent.setup();
    loaded([], [rosterPlayer()]);
    renderWithProviders(<HopperView bracketId="b1" />);

    await user.click(screen.getByRole('button', { name: /Kenny/ }));
    await user.click(await screen.findByText('Forget this player'));
    await user.click(screen.getByRole('button', { name: 'Forget' }));

    expect(mocks.forget).toHaveBeenCalledWith({ memberId: 'm-kenny' });
  });

  it('forgets a remembered walk-up by their saved name', async () => {
    const user = userEvent.setup();
    loaded([], [rememberedWalkup('Rocket')]);
    renderWithProviders(<HopperView bracketId="b1" />);

    await user.click(screen.getByRole('button', { name: /Rocket/ }));
    await user.click(await screen.findByText('Forget this player'));
    await user.click(screen.getByRole('button', { name: 'Forget' }));

    expect(mocks.forget).toHaveBeenCalledWith({ displayName: 'Rocket' });
  });

  it('explains what fills each group when it is empty', () => {
    loaded([]);
    renderWithProviders(<HopperView bracketId="b1" />);

    expect(screen.getByText(/nobody added yet/i)).toBeTruthy();
    expect(screen.getByText(/nobody waiting yet/i)).toBeTruthy();
    expect(screen.getByText(/past tournaments/i)).toBeTruthy();
    // Where waiting players come from is said once, on the always-visible form.
    expect(screen.getAllByText(/scan your qr code/i)).toHaveLength(1);
  });

  it('takes no actions once the tournament has started', () => {
    loaded([], [rosterPlayer()]);
    renderWithProviders(<HopperView bracketId="b1" readOnly />);

    fireEvent.click(screen.getByRole('button', { name: /Kenny/ }));
    expect(screen.queryByText('Add to this tournament')).toBeNull();
    expect(mocks.addRegistered).not.toHaveBeenCalled();
  });

  it('reports a failed load rather than showing empty groups', () => {
    mocks.hopper.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    mocks.roster.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderWithProviders(<HopperView bracketId="b1" />);

    expect(screen.getByText(/couldn't load the players/i)).toBeTruthy();
  });

  it('re-adds a remembered walk-up by name, not as a registered player', async () => {
    const user = userEvent.setup();
    loaded([], [rememberedWalkup('Rocket')]);
    renderWithProviders(<HopperView bracketId="b1" />);

    await user.click(screen.getByRole('button', { name: /Rocket/ }));
    await user.click(await screen.findByText('Add to this tournament'));

    expect(mocks.addWalkup).toHaveBeenCalledWith('Rocket');
    expect(mocks.addRegistered).not.toHaveBeenCalled();
  });

  it('lists registered past players and remembered walk-ups together', () => {
    loaded([], [rosterPlayer(), rememberedWalkup('Rocket')]);
    renderWithProviders(<HopperView bracketId="b1" />);

    expect(screen.getByText('Past players (2)')).toBeTruthy();
    expect(screen.getByText('Kenny')).toBeTruthy();
    expect(screen.getByText('Rocket')).toBeTruthy();
  });

  it('adds a typed name as a walk-up', async () => {
    const user = userEvent.setup();
    loaded([]);
    renderWithProviders(<HopperView bracketId="b1" />);

    await user.type(screen.getByLabelText('Add a player'), 'Rocket');
    await user.click(screen.getByRole('button', { name: /add this name/i }));

    expect(mocks.addWalkup).toHaveBeenCalledWith('Rocket');
  });

  it('offers no way to add players once the tournament has started', () => {
    loaded([]);
    renderWithProviders(<HopperView bracketId="b1" readOnly />);
    expect(screen.getByLabelText('Add a player')).toBeDisabled();
  });

  describe('without the entry-fee tracker (a separately sold feature)', () => {
    it('shows no paid/unpaid labels on the official list', () => {
      loaded([
        entry({ id: 'a', status: 'official', display_name: 'Mike', paid_status: 'unpaid' }),
      ]);
      renderWithProviders(<HopperView bracketId="b1" />);

      expect(screen.queryByText('Unpaid')).toBeNull();
      expect(screen.queryByText('Paid')).toBeNull();
    });

    it('admits with one plain action instead of a paid/unpaid choice', async () => {
      const user = userEvent.setup();
      loaded([entry({ id: 'a', status: 'hopper', display_name: 'Slim' })]);
      renderWithProviders(<HopperView bracketId="b1" />);

      await user.click(screen.getByRole('button', { name: /Slim/ }));
      expect(screen.queryByText('Add as paid')).toBeNull();
      expect(screen.queryByText('Add as unpaid')).toBeNull();

      await user.click(await screen.findByText('Add to tournament'));
      expect(mocks.admit).toHaveBeenCalledWith({ entryId: 'a', paidStatus: 'unpaid' });
    });

    it('offers no way to flip an admitted player\'s paid flag', async () => {
      const user = userEvent.setup();
      loaded([entry({ id: 'a', status: 'official', paid_status: 'unpaid' })]);
      renderWithProviders(<HopperView bracketId="b1" />);

      await user.click(screen.getByRole('button', { name: /Someone/ }));
      expect(screen.queryByText(/mark as/i)).toBeNull();
      // Removal is still available — it isn't a money action.
      expect(await screen.findByText('Remove')).toBeTruthy();
    });
  });

  describe('with the entry-fee tracker', () => {
    it('offers the paid and unpaid admit choices', async () => {
      const user = userEvent.setup();
      loaded([entry({ id: 'a', status: 'hopper', display_name: 'Slim' })]);
      renderWithProviders(<HopperView bracketId="b1" trackEntryFees />);

      await user.click(screen.getByRole('button', { name: /Slim/ }));
      await user.click(await screen.findByText('Add as paid'));

      expect(mocks.admit).toHaveBeenCalledWith({ entryId: 'a', paidStatus: 'paid' });
    });

    it('flips an admitted player\'s paid flag', async () => {
      const user = userEvent.setup();
      loaded([entry({ id: 'a', status: 'official', paid_status: 'unpaid' })]);
      renderWithProviders(<HopperView bracketId="b1" trackEntryFees />);

      await user.click(screen.getByRole('button', { name: /Someone/ }));
      await user.click(await screen.findByText('Mark as paid'));

      expect(mocks.setPaid).toHaveBeenCalledWith({ entryId: 'a', paidStatus: 'paid' });
    });
  });

  describe('the sweep-in choice', () => {
    it('sits with the waiting list, and is off by default', () => {
      loaded([entry({ id: 'a', status: 'hopper' })]);
      renderWithProviders(
        <HopperView bracketId="b1" onIncludeWaitingChange={vi.fn()} />
      );

      const box = screen.getByLabelText(/add anyone still waiting when i start/i);
      expect(box.getAttribute('data-state')).toBe('unchecked');
    });

    it('is offered before anyone has arrived, since it is a standing rule', () => {
      loaded([]);
      renderWithProviders(
        <HopperView bracketId="b1" onIncludeWaitingChange={vi.fn()} />
      );
      expect(screen.getByLabelText(/add anyone still waiting when i start/i)).toBeTruthy();
    });

    it('reports the change rather than acting on it', () => {
      const onIncludeWaitingChange = vi.fn();
      loaded([]);
      renderWithProviders(
        <HopperView bracketId="b1" onIncludeWaitingChange={onIncludeWaitingChange} />
      );

      fireEvent.click(screen.getByLabelText(/add anyone still waiting when i start/i));
      expect(onIncludeWaitingChange).toHaveBeenCalledWith(true);
    });

    it('mentions unpaid only when the tournament tracks entry fees', () => {
      loaded([]);
      const { rerender } = renderWithProviders(
        <HopperView bracketId="b1" onIncludeWaitingChange={vi.fn()} trackEntryFees />
      );
      expect(screen.getByText(/go in as unpaid/i)).toBeTruthy();

      rerender(<HopperView bracketId="b1" onIncludeWaitingChange={vi.fn()} />);
      expect(screen.queryByText(/unpaid/i)).toBeNull();
    });
  });

  describe('searching for a registered player', () => {
    it('offers a search alongside the type-a-name box', () => {
      loaded([]);
      renderWithProviders(<HopperView bracketId="b1" />);

      expect(screen.getByLabelText(/search players/i)).toBeTruthy();
      expect(screen.getByLabelText(/add a player/i)).toBeTruthy();
    });

    it('says plainly which box is for whom', () => {
      loaded([]);
      renderWithProviders(<HopperView bracketId="b1" />);
      expect(screen.getByText(/for players with an account/i)).toBeTruthy();
    });

    it('takes no additions once the tournament has started', () => {
      loaded([]);
      renderWithProviders(<HopperView bracketId="b1" readOnly />);
      expect(screen.getByLabelText(/search players/i)).toBeDisabled();
    });
  });
});
