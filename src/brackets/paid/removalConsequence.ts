/**
 * @fileoverview What removing a hopper entry actually costs the organizer (Unit C3).
 *
 * The Remove confirm has three true answers, not one, and which one applies
 * turns on rules that live elsewhere (the roster triggers). Kept as its own
 * pure function so the promise the dialog makes stays testable and can't quietly
 * drift out of step with what the database really keeps:
 *
 *  • A registered player joins the sticky roster the moment they're admitted,
 *    and removal never touches it.
 *  • A walk-up already in the tournament had their NAME remembered by that same
 *    admission, so they're one tap away next time too.
 *  • A walk-up still waiting was never admitted, so nothing has been saved yet
 *    and the name really would have to be re-typed.
 */

import type { HopperRow } from './hopperGroups';

/**
 * The sentence shown under "Remove {name}?".
 *
 * @param row - The entry about to be removed.
 * @returns Plain-language consequence, accurate for this row's kind and status.
 */
export function removalConsequence(row: HopperRow): string {
  if (row.identity.kind === 'registered') {
    return 'They come out of this tournament. They stay in your past players, so you can add them back with one tap.';
  }
  if (row.entry.status === 'official') {
    return "They come out of this tournament. Their name stays in your past players, so you won't have to type it again.";
  }
  return "They come out of this tournament. They were never added to it, so the name isn't saved yet — you'd have to type it again.";
}
