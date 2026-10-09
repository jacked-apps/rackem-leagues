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
import { emptySeatsLabel, playersChipLabel, seatLine } from './seatCopy';

const seats = (devices: number, open: number) => ({ devices, used: 4 - open, seats: 4, open });

const phone = (id: string, name: string, over: Partial<RoomPhone> = {}): RoomPhone => ({
  id, member_id: `m-${id}`, device_id: `d-${id}`, display_name: name,
  is_host: false, is_present: true, last_seen_at: '', joined_at: '', ...over,
});
const ED = phone('p1', 'Ed', { is_host: true });
const JACK = phone('p2', 'Jack');
const AWAY = phone('p3', 'Sam', { is_present: false });

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
  it('counts THIS room and reports the house seats left', () => {
    expect(playersChipLabel(seats(2, 2), true)).toBe('Players 2 · 2 open');
    expect(playersChipLabel(seats(1, 1), true)).toBe('Players 1 · 1 open');
  });

  it('says "full" rather than "0 open"', () => {
    expect(playersChipLabel(seats(4, 0), true)).toBe('Players 4 · full');
  });

  it('a free room counts players only — it has no seats to offer yet', () => {
    expect(playersChipLabel(seats(1, 3), false)).toBe('Players 1');
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
    expect(screen.getByRole('button', { name: /Players 2 · 2 open/ })).toBeInTheDocument();
    expect(screen.queryByText('Jack')).toBeNull();
  });

  it('the panel lists every screen with its words', () => {
    renderChip({ phones: [ED, JACK, AWAY] });
    openPanel();
    expect(screen.getByText('Ed')).toBeInTheDocument();
    expect(screen.getByText('you · host')).toBeInTheDocument();
    expect(screen.getByText('Jack')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByText('away')).toBeInTheDocument();
  });

  it('shared room: the panel offers the invite and does NOT repeat the seat count', () => {
    renderChip();
    openPanel();
    // The count is on the chip the user just tapped; twice on one screen was
    // the thing Ed flagged.
    expect(screen.queryByText(/seats open/)).toBeNull();
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
