/**
 * @fileoverview Seed module: match identity.
 *
 * Reads the match's team IDs and season ID from `context.matchData`
 * and writes them to the state bag. Downstream threshold modules (esp.
 * team-bonus) read these from the bag.
 *
 * One of a handful of seed modules — the only kind of module that
 * reads from outside the bag. Every other module reads only the bag.
 * See CLAUDE.md principles 2 and 3.
 */

import type { Context, Module, StateBag } from '@/systems/chain-runtime/types';

/**
 * Narrow context shape this module needs. The runtime hands the
 * module a generic Context; the module casts to read what it expects.
 * Missing fields produce undefined bag writes (never throws).
 */
type MatchIdentityContext = Context & {
  readonly matchData?: {
    readonly home_team_id?: string | null;
    readonly away_team_id?: string | null;
    readonly season_id?: string | null;
  } | null;
};

/**
 * Writes `home_team_id`, `away_team_id`, `season_id` to the bag.
 * If a field is missing or null in matchData, writes `null` for that
 * key — never throws.
 */
export const seedMatchIdentity: Module = {
  name: 'seedMatchIdentity',
  run: (bag: StateBag, context: Context) => {
    const ctx = context as MatchIdentityContext;
    const md = ctx.matchData ?? null;
    bag.home_team_id = md?.home_team_id ?? null;
    bag.away_team_id = md?.away_team_id ?? null;
    bag.season_id = md?.season_id ?? null;
  },
};
