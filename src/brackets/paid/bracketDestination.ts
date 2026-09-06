/**
 * @fileoverview Where a tournament should open (Phase C, Unit C3).
 *
 * A tournament has two possible homes and the right one depends on its state,
 * so the rule lives in one place rather than being re-derived at each link.
 *
 * A "Real players & sign-up" tournament SITS in `setup` on purpose — that is the
 * whole point, it waits there while players scan in over an evening. Opening it
 * from the tournaments list must land on its hopper, not on a bracket that has
 * no matches yet.
 *
 * Everything else — the free tier, and any paid tournament without sign-up —
 * is created and started in one submit, so it never idles in `setup` and always
 * belongs on the bracket view.
 */

import { hasPremiumFeature } from './premiumFeatures';

/** The minimum a caller needs to know to route a tournament. */
export interface RoutableBracket {
  id: string;
  status: string;
  premium_features: string[] | null;
}

/**
 * The path this tournament should open at.
 *
 * @example
 * bracketDestination({ id: 'b1', status: 'setup', premium_features: ['real_players'] })
 * // → '/brackets/b1/setup'
 */
export function bracketDestination(bracket: RoutableBracket): string {
  return usesHopperSetup(bracket) ? `/brackets/${bracket.id}/setup` : `/brackets/${bracket.id}`;
}

/**
 * Whether this tournament's home is the hopper setup screen — it bought sign-up
 * links AND has not started yet. Both halves matter: without the feature there
 * is no hopper to show, and once it starts the setup screen is meaningless.
 */
export function usesHopperSetup(bracket: RoutableBracket): boolean {
  return bracket.status === 'setup' && hasPremiumFeature(bracket.premium_features, 'real_players');
}
