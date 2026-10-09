/**
 * @fileoverview The seat picture as words — shared by the seat counter, the
 * invite sheet, and the join page so "3 here · 1 seat open" reads the
 * same everywhere it appears.
 *
 * House model (Unit 8): seats belong to the room's HOST and span every room
 * they own, so "open" is the host's house, not this room. `devices` is still
 * this room's headcount — the thing a person standing at the table wants.
 */
import type { RoomSeats } from '@/api/queries/rooms';

/** "1 seat open" / "2 seats open" / "no seats open". */
export function emptySeatsLabel(open: number): string {
  if (open <= 0) return 'no seats open';
  return `${open} seat${open === 1 ? '' : 's'} open`;
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

/**
 * The players chip's always-visible line: "Players 2 · 1 open".
 *
 * `Players N` is THIS room's present screens — what a person at the table
 * counts. "N open" is the HOST'S house (seats span every room they own), so
 * it is the number that decides whether the next person gets in. Two
 * different things on purpose; the chip's panel spells out whose house it is.
 * A free room has no seats to offer yet, so it counts players only.
 */
export function playersChipLabel(seats: RoomSeats, shared: boolean): string {
  const players = `Players ${seats.devices}`;
  if (!shared) return players;
  return `${players} · ${seats.open > 0 ? `${seats.open} open` : 'full'}`;
}
