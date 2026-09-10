/**
 * @fileoverview The rules of a coin flip, with no React and no ambient randomness.
 *
 * Everything here is pure and total: given the same inputs it returns the same
 * output, and every input combination produces a winner. That is what lets the
 * winner-selection rule be proven without rendering anything, and it is why the
 * random source is a parameter rather than a call to `Math.random` at module
 * scope.
 *
 * Used by `CoinFlip.tsx`, but usable on its own by any caller that wants the
 * outcome without the ceremony.
 */

import type {
  Call,
  Face,
  FaceAssignment,
  FlipResult,
  Participant,
  RandomSource,
} from './types';

/**
 * Toss the coin.
 *
 * Splits [0, 1) at the halfway point: below 0.5 is heads, at or above is tails.
 * The boundary is pinned by tests, because a `<` that should be `<=` (or the
 * reverse) produces a coin that is subtly biased rather than obviously broken —
 * the kind of defect that ships and then quietly decides who breaks for a
 * season.
 *
 * @param random - Source of randomness in [0, 1). Defaults to `Math.random`.
 * @returns The side the coin landed on.
 */
export function tossCoin(random: RandomSource = Math.random): Face {
  return random() < 0.5 ? 'heads' : 'tails';
}

/**
 * Decide who won.
 *
 * The caller nominated a side before the toss; if the coin agrees with them
 * they win, otherwise the other participant does. This is the only place a
 * winner is chosen, so both the called flip and the quick flip resolve through
 * it and neither mode can drift into its own idea of who won.
 *
 * @param call - The side the caller nominated.
 * @param face - The side the coin landed on.
 * @param caller - The participant who made the call.
 * @param other - The participant who did not.
 * @returns The settled result, including enough context to explain it.
 *
 * @example
 * // Mike called heads, the coin landed tails, so John wins.
 * resolveFlip('heads', 'tails', mike, john).winner // => john
 */
export function resolveFlip(
  call: Call,
  face: Face,
  caller: Participant,
  other: Participant
): FlipResult {
  const callerWon = call === face;

  return {
    winner: callerWon ? caller : other,
    loser: callerWon ? other : caller,
    face,
    call,
    callerId: caller.id,
  };
}

/**
 * Decide which participant holds heads, for a quick flip.
 *
 * WHY THIS EXISTS, since it looks redundant: it is not here to make the flip
 * fairer. Assigning the faces at random and then tossing produces exactly the
 * same 50/50 as tossing alone — combining two fair coins yields one fair coin,
 * so there is no additional fairness available to buy.
 *
 * It is here for how the result is *perceived*. If heads always went to
 * whoever was entered first, a player who notices they are always tails will
 * decide the app has it in for them. It does not, but a coin flip only works if
 * both sides accept it, so the appearance of neutrality is the thing worth
 * paying for.
 *
 * So: do not remove this believing it is a redundant toss, and do not add a
 * further randomization believing it compounds. Neither is true.
 *
 * @param a - One participant.
 * @param b - The other participant.
 * @param random - Source of randomness in [0, 1). Defaults to `Math.random`.
 * @returns Which participant holds each side.
 */
export function assignFaces(
  a: Participant,
  b: Participant,
  random: RandomSource = Math.random
): FaceAssignment {
  return random() < 0.5 ? { heads: a, tails: b } : { heads: b, tails: a };
}

/**
 * Shuffle which participant is displayed first.
 *
 * Purely cosmetic, so that the same name is not always on top. It must never
 * feed the winner calculation — a test pins that varying only this leaves the
 * winner unchanged, so a display shuffle can never quietly become load-bearing.
 *
 * @param a - One participant.
 * @param b - The other participant.
 * @param random - Source of randomness in [0, 1). Defaults to `Math.random`.
 * @returns The two participants in display order.
 */
export function shuffleOrder(
  a: Participant,
  b: Participant,
  random: RandomSource = Math.random
): [Participant, Participant] {
  return random() < 0.5 ? [a, b] : [b, a];
}

/**
 * The call a quick flip makes on the player's behalf.
 *
 * In a quick flip nobody nominates a side, so the app calls heads for whoever
 * was assigned heads. Shared by the component and by `quickFlip` below so the
 * two cannot drift into different conventions.
 */
export const QUICK_CALL: Call = 'heads';

/**
 * Run a whole quick flip and return the winner. No React, no UI, no waiting.
 *
 * This is the coin flip as a plain two-outcome randomizer, for the times the
 * system needs a fair pick between two sides without anyone watching it happen
 * — "set a random breaker" rather than "flip for the break". Callers that DO
 * want it watched mount `CoinFlip` instead; this is the same decision with the
 * ceremony removed, not a different one.
 *
 * It deliberately still assigns faces before tossing, even though nothing is on
 * screen to perceive that assignment. Keeping the steps identical to the
 * visual path is what makes the two provably the same flip: given the same
 * random source, this function and the mounted component produce the same
 * winner, and a test pins exactly that. Skipping the assignment here would save
 * one call and quietly make the silent and visible flips two different things.
 *
 * @param a - One participant.
 * @param b - The other participant.
 * @param random - Source of randomness in [0, 1). Defaults to `Math.random`.
 * @returns The settled result, including who lost and what the coin did.
 *
 * @example
 * // Pick a breaker with no ceremony, then persist it.
 * const { winner } = quickFlip(homePlayer, awayPlayer);
 * // winner.id is the id you passed in — write it straight to the game record.
 */
export function quickFlip(
  a: Participant,
  b: Participant,
  random: RandomSource = Math.random
): FlipResult {
  const assignment = assignFaces(a, b, random);
  const face = tossCoin(random);

  return resolveFlip(QUICK_CALL, face, assignment.heads, assignment.tails);
}
