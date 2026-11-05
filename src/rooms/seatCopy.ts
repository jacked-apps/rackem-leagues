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
 * The players chip's always-visible line: "Players 1 of 2".
 *
 * Both numbers describe THIS room: the screens in it, out of what its GAME
 * seats (`room_max`). Counts everyone, host included — the host is a person
 * in the room, and their screen holds a place like anybody's.
 *
 * It used to read out of the HOUSE total, which Ed caught in testing: a
 * coin-flip room holding one person announced "2 of 4", describing a
 * different room than the one on screen and advertising space for two people
 * who would have had nothing to do. The house figure is the host's billing
 * concern and lives in the panel.
 *
 * A free room cannot be joined at all, so there is nothing to count against.
 */
export function playersChipLabel(seats: RoomSeats, shared: boolean): string {
  if (!shared) return `Players ${seats.devices}`;
  return `Players ${seats.devices} of ${seats.room_max}`;
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
