/**
 * @fileoverview Tests for the seat counter — the copy for every seat state,
 * and which tap does what: invite on a shared room, open-the-door for a host
 * on a free room, nothing for a guest on a free room.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeatCounter } from './SeatCounter';
import { emptySeatsLabel, seatLine } from './seatCopy';

const seats = (devices: number, open: number) => ({ devices, guests: 3 - open, seats: 3, open });

describe('seatCopy', () => {
  it('pluralises guest seats and names zero', () => {
    expect(emptySeatsLabel(1)).toBe('1 guest seat open');
    expect(emptySeatsLabel(2)).toBe('2 guest seats open');
    expect(emptySeatsLabel(0)).toBe('no guest seats open');
  });

  it('a free room says how to get seats instead of counting them', () => {
    expect(seatLine(seats(3, 1), true)).toBe('3 here · 1 guest seat open');
    expect(seatLine(seats(1, 3), false)).toBe('1 here · open the door to invite');
  });
});

describe('SeatCounter', () => {
  it('shared room: shows the count and the tap invites', () => {
    const onInvite = vi.fn();
    render(<SeatCounter seats={seats(3, 1)} shared isHost={false} onInvite={onInvite} onOpenDoor={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /3 here · 1 guest seat open/ }));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it('shared room with no seats: still a tap (the sheet explains)', () => {
    const onInvite = vi.fn();
    render(<SeatCounter seats={seats(4, 0)} shared isHost={false} onInvite={onInvite} onOpenDoor={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /no guest seats open/ }));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it('free room, host: the door copy and the tap offers the door', () => {
    const onOpenDoor = vi.fn();
    render(<SeatCounter seats={seats(1, 3)} shared={false} isHost onInvite={vi.fn()} onOpenDoor={onOpenDoor} />);
    fireEvent.click(screen.getByRole('button', { name: /open the door/ }));
    expect(onOpenDoor).toHaveBeenCalledTimes(1);
  });

  it('free room, guest: plain text, no button', () => {
    render(<SeatCounter seats={seats(1, 3)} shared={false} isHost={false} onInvite={vi.fn()} onOpenDoor={vi.fn()} />);
    expect(screen.getByText('1 here · open the door to invite')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
