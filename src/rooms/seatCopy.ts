/**
 * @fileoverview The seat picture as words — shared by the seat counter, the
 * invite sheet, and the join page so "3 here · 1 empty seat" reads the same
 * everywhere it appears.
 */
import type { RoomSeats } from '@/api/queries/rooms';

/** "1 empty seat" / "2 empty seats" / "no empty seats". */
export function emptySeatsLabel(open: number): string {
  if (open <= 0) return 'no empty seats';
  return `${open} empty seat${open === 1 ? '' : 's'}`;
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
