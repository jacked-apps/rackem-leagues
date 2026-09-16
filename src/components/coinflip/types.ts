/**
 * @fileoverview Types for the reusable coin flip.
 *
 * The whole point of this component is that it does not know what it is
 * deciding. It settles who breaks first, who wins a tie, or an argument about
 * who buys the next round — and it cannot tell those apart, because a
 * participant is nothing but an id and a name.
 *
 * That is why there is no `playerId`, no `teamId`, and no match context
 * anywhere in this folder. A player and a team are the same shape here, which
 * is what lets one component serve league play, tournaments, and individual
 * races without branching on any of them.
 */

/**
 * One side of a coin flip.
 *
 * Deliberately minimal. Callers pass whatever they already have — a player row,
 * a team row, or two names typed into a box — reduced to these two fields. The
 * `id` is what the flip resolves against, so two participants who happen to
 * share a name still resolve correctly.
 */
export interface Participant {
  /** Stable identifier. Used for resolution; names are for humans only. */
  id: string;
  /** Display name, shown to the people watching the flip. */
  name: string;
}

/** The side a caller nominates before the coin is tossed. */
export type Call = 'heads' | 'tails';

/** The side the coin actually lands on. */
export type Face = 'heads' | 'tails';

/**
 * A source of randomness in the range [0, 1).
 *
 * Injected rather than imported so tests can pin an exact outcome without
 * monkey-patching a global, and so a caller that needs the result decided
 * somewhere other than this device can supply its own. One seam, two jobs.
 */
export type RandomSource = () => number;

/**
 * The outcome of a settled flip.
 *
 * Carries more than the winner so a caller can show its work — "called heads,
 * landed tails" is the sentence that makes the result believable to the person
 * who lost. A flip cannot tie, so `winner` and `loser` are always both present.
 */
export interface FlipResult {
  /** The participant who won the flip. */
  winner: Participant;
  /** The participant who did not. */
  loser: Participant;
  /** The side the coin landed on. */
  face: Face;
  /** The side that was called before the toss. */
  call: Call;
  /** The id of the participant whose call it was. */
  callerId: string;
}

/**
 * Which participant holds which side, decided before the coin is tossed.
 *
 * Only used by quick mode, where the app makes the call instead of a human.
 * It exists as its own type because the assignment is shown on screen as a
 * distinct step — the players watch it being made, then watch the coin.
 */
export interface FaceAssignment {
  /** The participant holding heads. */
  heads: Participant;
  /** The participant holding tails. */
  tails: Participant;
}
