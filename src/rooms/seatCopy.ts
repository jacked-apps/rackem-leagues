/**
 * @fileoverview The seat picture as words — shared by the seat counter, the
 * invite sheet, and the join page so "3 here · 1 guest seat open" reads the
 * same everywhere it appears.
 *
 * House model (Unit 8): seats belong to the room's HOST and span every room
 * they own, so "open" is the host's house, not this room. `devices` is still
 * this room's headcount — the thing a person standing at the table wants.
 */
import type { RoomSeats } from '@/api/queries/rooms';

/** "1 guest seat open" / "2 guest seats open" / "no guest seats open". */
export function emptySeatsLabel(open: number): string {
  if (open <= 0) return 'no guest seats open';
  return `${open} guest seat${open === 1 ? '' : 's'} open`;
}

/**
 * The whole line. A free room has no seats to offer yet, so it says how to
 * get some instead of counting them.
 */
export function seatLine(seats: RoomSeats, shared: boolean): string {
  const here = `${seats.devices} here`;
  if (!shared) return `${here} · open the door to invite`;
  return `${here} · ${emptySeatsLabel(seats.open)}`;
}
