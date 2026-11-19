/**
 * @fileoverview Pricing math for the Become a League Operator example: the
 * season cost and what it is as a share of the prize pool. Kept apart from
 * the row component so it can be tested on its own.
 *
 *   cost       = teams × weeks × $1 + $10 setup
 *   prize pool = teams × weeks × $50 (example: 5 players × $10 a league night)
 *   share      = cost ÷ prize pool, one decimal
 */

/** Price per team per week, in dollars. */
export const PRICE_PER_TEAM_WEEK = 1;
/** One-time setup fee per season, in dollars. */
export const SETUP_FEE = 10;
/** Example: players on each team. */
export const EXAMPLE_PLAYERS_PER_TEAM = 5;
/** Example: what each player pays per league night, in dollars. */
export const EXAMPLE_DUES_PER_PLAYER_NIGHT = 10;
/** Example prize-pool money each team puts in per league night (5 × $10 = $50). */
export const EXAMPLE_POOL_PER_TEAM_WEEK = EXAMPLE_PLAYERS_PER_TEAM * EXAMPLE_DUES_PER_PLAYER_NIGHT;

/** Whole dollars with thousands separators, e.g. 6400 → "$6,400". */
export const dollars = (n: number) => `$${n.toLocaleString('en-US')}`;

/**
 * The cost, prize pool and share for one example league size.
 *
 * @param teams - Teams in the league.
 * @param weeks - Regular-season weeks.
 * @returns cost and pool in dollars, and share as a one-decimal percent string.
 */
export function seasonPricing(teams: number, weeks: number) {
  const cost = teams * weeks * PRICE_PER_TEAM_WEEK + SETUP_FEE;
  const pool = teams * weeks * EXAMPLE_POOL_PER_TEAM_WEEK;
  return { cost, pool, share: `${((cost / pool) * 100).toFixed(1)}%` };
}
