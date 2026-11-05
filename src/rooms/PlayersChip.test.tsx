/**
 * @fileoverview Tests for the players chip — the one line the room always
 * shows, and the panel behind it (list, invite/door, host's remove).
 *
 * The chip replaced a seat-counter button plus an always-open list; these
 * cover the copy for every seat state and which tap does what.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RoomPhone } from '@/api/queries/rooms';
import { PlayersChip } from './PlayersChip';
import { elsewhereNote, emptySeatsLabel, playersChipLabel, seatLine } from './seatCopy';

const seats = (devices: number, open: number, roomMax = 2) => ({ devices, room_max: roomMax, used: 4 - open, seats: 4, open });

const phone = (id: string, name: string, over: Partial<RoomPhone> = {}): RoomPhone => ({
  id, member_id: `m-${id}`, device_id: `d-${id}`, display_name: name,
  is_host: false, is_present: true, has_left: false, last_seen_at: '', joined_at: '', ...over,
});
const ED = phone('p1', 'Ed', { is_host: true });
const JACK = phone('p2', 'Jack');
const AWAY = phone('p3', 'Sam', { is_present: false });
const LEFT = phone('p4', 'Mo', { is_present: false, has_left: true });

const props = {
  seats: seats(2, 2),
  phones: [ED, JACK],
  shared: true,
  isHost: true,
  myPhoneId: 'p1',
  onInvite: vi.fn(),
  onOpenDoor: vi.fn(),
  onRemove: vi.fn(),
};

const renderChip = (over: Partial<typeof props> = {}) =>
  render(<PlayersChip {...props} {...over} />);

/** Open the panel. */
const openPanel = () => fireEvent.click(screen.getByRole('button', { name: /Players/ }));

beforeEach(() => vi.clearAllMocks());

describe('playersChipLabel', () => {
  it('counts THIS room out of what its GAME seats, host included', () => {
    expect(playersChipLabel(seats(1, 3), true)).toBe('Players 1 of 2');
    expect(playersChipLabel(seats(2, 2), true)).toBe('Players 2 of 2');
  });

  it('a bigger game gets a bigger denominator — occupancy is the game\u2019s, not the house\u2019s', () => {
    expect(playersChipLabel(seats(3, 1, 6), true)).toBe('Players 3 of 6');
  });

  it('ignores the house figure entirely: a busy house does not change this room', () => {
    // 1 screen here, 3 across the host's rooms — the chip describes the room.
    expect(playersChipLabel({ devices: 1, room_max: 2, used: 3, seats: 4, open: 1 }, true))
      .toBe('Players 1 of 2');
  });

  it('a free room cannot be joined, so there is nothing to count against', () => {
    expect(playersChipLabel(seats(1, 3), false)).toBe('Players 1');
  });
});

describe('elsewhereNote', () => {
  it('says nothing when the chip and the list agree', () => {
    expect(elsewhereNote(seats(2, 2), true)).toBeNull();
  });

  it('explains the gap when the host has screens in other rooms', () => {
    expect(elsewhereNote({ devices: 1, used: 3, seats: 4, open: 1 }, true))
      .toBe('2 more screens are in your other rooms.');
    expect(elsewhereNote({ devices: 1, used: 2, seats: 4, open: 2 }, false))
      .toBe("1 more screen is in the host's other rooms.");
  });
});

describe('seatCopy (still used by the panel and the join page)', () => {
  it('pluralises seats and names zero', () => {
    expect(emptySeatsLabel(1)).toBe('1 seat open');
    expect(emptySeatsLabel(2)).toBe('2 seats open');
    expect(emptySeatsLabel(0)).toBe('no seats open');
  });

  it('the join page line counts the room and the house', () => {
    expect(seatLine(seats(3, 1), true)).toBe('3 here · 1 seat open');
    expect(seatLine(seats(1, 3), false)).toBe('1 here · open the door to invite');
  });
});

describe('PlayersChip', () => {
  it('shows only the chip until it is tapped', () => {
    renderChip();
    expect(screen.getByRole('button', { name: /Players 2 of 2/ })).toBeInTheDocument();
    expect(screen.queryByText('Jack')).toBeNull();
  });

  it('the panel lists every screen on the guest list, with its words', () => {
    renderChip({ phones: [ED, JACK, AWAY, LEFT] });
    openPanel();
    expect(screen.getByText('Ed')).toBeInTheDocument();
    expect(screen.getByText('you · host')).toBeInTheDocument();
    expect(screen.getByText('Jack')).toBeInTheDocument();

    // Two kinds of absence, two words — both are still ON the guest list.
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByText('away')).toBeInTheDocument();
    expect(screen.getByText('Mo')).toBeInTheDocument();
    expect(screen.getByText('left')).toBeInTheDocument();
  });

  it('the panel shows the OTHER capacity — the house — and the invite', () => {
    renderChip();
    openPanel();
    // The chip says this room; the panel says the host's house. Not a repeat.
    expect(screen.getByText(/2 seats open in your house/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    expect(props.onInvite).toHaveBeenCalledTimes(1);
  });

  it('a guest gets the same panel and the same invite', () => {
    renderChip({ isHost: false, myPhoneId: 'p2' });
    openPanel();
    expect(screen.getByRole('button', { name: 'Invite someone' })).toBeInTheDocument();
  });

  it('free room: the host is offered the door, a guest is not', () => {
    renderChip({ shared: false, phones: [ED] });
    openPanel();
    expect(screen.getByText(/Private — one screen only/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open to others' }));
    expect(props.onOpenDoor).toHaveBeenCalledTimes(1);

    renderChip({ shared: false, phones: [ED], isHost: false, myPhoneId: 'p2' });
    expect(screen.queryByRole('button', { name: 'Open to others' })).toBeNull();
  });

  it('the host can remove another screen but never their own', () => {
    renderChip();
    openPanel();
    expect(screen.queryByRole('button', { name: /Remove Ed/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Remove Jack from the room/ }));
    expect(props.onRemove).toHaveBeenCalledWith(JACK);
  });

  it('a guest gets no remove controls at all', () => {
    renderChip({ isHost: false, myPhoneId: 'p2' });
    openPanel();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });
});

describe('PlayersChip — the host with a second room open', () => {
  it('the chip stays about this room; the panel explains the busy house', () => {
    renderChip({ seats: { devices: 1, room_max: 2, used: 3, seats: 4, open: 1 }, phones: [ED] });
    expect(screen.getByRole('button', { name: /Players 1 of 2/ })).toBeInTheDocument();

    openPanel();
    expect(screen.getByText(/1 seat open in your house/)).toBeInTheDocument();
    expect(screen.getByText(/2 more screens are in your other rooms./)).toBeInTheDocument();
  });
});
