/**
 * @fileoverview Tests for HopperView — the organizer's three-group setup screen.
 *
 * Covers the shape the organizer relies on: a sticky count bar, the three groups
 * stacked in order (in the tournament → waiting → past players) with each
 * player appearing exactly once, the per-group empty copy, and the one-tap add
 * from past players.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/utils';
import type { HopperEntry, RosterPlayer } from '@/api/queries/brackets';

const mocks = vi.hoisted(() => ({
  hopper: vi.fn(),
  roster: vi.fn(),
  admit: vi.fn(),
  setPaid: vi.fn(),
  eject: vi.fn(),
  addRegistered: vi.fn(),
  addWalkup: vi.fn(),
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
  mocks.addRegistered.mockResolvedValue(undefined);
  mocks.addWalkup.mockResolvedValue(undefined);
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
    renderWithProviders(<HopperView bracketId="b1" />);

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

  it('adds a past player to the hopper on one tap', () => {
    loaded([], [rosterPlayer()]);
    renderWithProviders(<HopperView bracketId="b1" />);

    fireEvent.click(screen.getByRole('button', { name: /Kenny/ }));

    expect(mocks.addRegistered).toHaveBeenCalledWith({
      memberId: 'm-kenny',
      displayName: 'Kenny',
    });
  });

  it('explains what fills each group when it is empty', () => {
    loaded([]);
    renderWithProviders(<HopperView bracketId="b1" />);

    expect(screen.getByText(/nobody added yet/i)).toBeTruthy();
    expect(screen.getByText(/scan your qr code/i)).toBeTruthy();
    expect(screen.getByText(/past tournaments/i)).toBeTruthy();
  });

  it('takes no actions once the tournament has started', () => {
    loaded([], [rosterPlayer()]);
    renderWithProviders(<HopperView bracketId="b1" readOnly />);

    fireEvent.click(screen.getByRole('button', { name: /Kenny/ }));
    expect(mocks.addRegistered).not.toHaveBeenCalled();
  });

  it('reports a failed load rather than showing empty groups', () => {
    mocks.hopper.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    mocks.roster.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderWithProviders(<HopperView bracketId="b1" />);

    expect(screen.getByText(/couldn't load the players/i)).toBeTruthy();
  });

  it('re-adds a remembered walk-up by name, not as a registered player', () => {
    loaded([], [rememberedWalkup('Rocket')]);
    renderWithProviders(<HopperView bracketId="b1" />);

    fireEvent.click(screen.getByRole('button', { name: /Rocket/ }));

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
});
