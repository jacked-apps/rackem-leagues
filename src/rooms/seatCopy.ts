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
 * The players chip's always-visible line: "Players 3 of 4".
 *
 * Counts EVERY screen, host included. The host's own devices consume seats
 * (house model, Unit 8), so "guests out of 3" would not be a stable number —
 * a host with a phone and a tablet leaves guests only two. Out of four, the
 * denominator never moves.
 *
 * The numerator is the HOUSE count (`used`), not just this room's screens, so
 * the chip always answers the question that matters: can one more get in? In
 * the ordinary one-room case it is the same number as the people in front of
 * you; when the host has a second room open it stays correct, and the panel
 * adds a line explaining where the others are.
 *
 * A free room has no seats to offer, so it counts the room and stops.
 */
export function playersChipLabel(seats: RoomSeats, shared: boolean): string {
  if (!shared) return `Players ${seats.devices}`;
  return `Players ${seats.used} of ${seats.seats}`;
}

/**
 * "2 of these are in your other rooms." — shown in the panel only when the
 * chip's house count is ahead of the screens in THIS room, which is the one
 * case where the chip and the list below it disagree.
 *
 * @returns The sentence, or null when there is nothing to explain.
 */
export function elsewhereNote(seats: RoomSeats, isHost: boolean): string | null {
  const elsewhere = seats.used - seats.devices;
  if (elsewhere <= 0) return null;
  const whose = isHost ? 'your other rooms' : "the host's other rooms";
  return `${elsewhere} more ${elsewhere === 1 ? 'screen is' : 'screens are'} in ${whose}.`;
}
