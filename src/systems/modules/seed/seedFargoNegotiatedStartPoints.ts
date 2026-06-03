/**
 * @fileoverview Seed module: Fargo negotiated start points.
 *
 * Reads the pre-negotiated start-points values from
 * `context.matchData.home_to_tie` / `away_to_tie` and writes them
 * under semantic names in the bag: `negotiated_home_start_points` and
 * `negotiated_away_start_points`.
 *
 * Why a separate seed for these: in Fargo points-mode leagues, the
 * captains' start-points negotiation runs UPSTREAM of match prep and
 * lands its agreed values on `matches.home_to_tie` / `away_to_tie`.
 * Prep just preserves those values. The Fargo points-mode threshold
 * modules read these bag entries as if any other seed had produced
 * them — they don't know the values came from a negotiation flow.
 *
 * For non-Fargo leagues this seed has no effect downstream (no
 * threshold module reads `negotiated_*_start_points`). Workshop
 * decides whether to include this seed in a system's chain.
 */

import type { Context, Module, StateBag } from '@/systems/chain-runtime/types';

type FargoNegotiationContext = Context & {
  readonly matchData?: {
    readonly home_to_tie?: number | null;
    readonly away_to_tie?: number | null;
  } | null;
};

/**
 * Writes `negotiated_home_start_points` and `negotiated_away_start_points`
 * from the matches-row negotiation columns. Null/missing values become
 * null in the bag.
 */
export const seedFargoNegotiatedStartPoints: Module = {
  name: 'seedFargoNegotiatedStartPoints',
  run: (bag: StateBag, context: Context) => {
    const ctx = context as FargoNegotiationContext;
    const md = ctx.matchData ?? null;
    bag.negotiated_home_start_points = md?.home_to_tie ?? null;
    bag.negotiated_away_start_points = md?.away_to_tie ?? null;
  },
};
