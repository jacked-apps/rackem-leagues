/**
 * @fileoverview Pricing math for the Become a League Operator example: the
 * season cost and what it is as a share of the prize pool. Kept apart from
 * the row component so it can be tested on its own.
 *
 *   cost       = teams × weeks × $1 + $10 setup
 *   prize pool = teams × weeks × $50 (example: 5 players × $10 a league night)
 *   share      = cost ÷ prize pool, one decimal
 *   paid by    = the first week whose dues so far cover the whole price
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
 * The cost, prize pool, share, and how soon dues cover the cost, for one
 * example league size.
 *
 * `paidByWeek` is the first week whose running total of dues
 * (teams × $50 per week) reaches the season's whole price.
 *
 * @param teams - Teams in the league.
 * @param weeks - Regular-season weeks.
 * @returns cost, pool and weekly dues in dollars; share as a one-decimal
 *   percent string; paidByWeek as a week number.
 */
export function seasonPricing(teams: number, weeks: number) {
  const cost = teams * weeks * PRICE_PER_TEAM_WEEK + SETUP_FEE;
  const weeklyDues = teams * EXAMPLE_POOL_PER_TEAM_WEEK;
  const pool = weeklyDues * weeks;
  return {
    cost,
    pool,
    weeklyDues,
    share: `${((cost / pool) * 100).toFixed(1)}%`,
    paidByWeek: Math.ceil(cost / weeklyDues),
  };
}
