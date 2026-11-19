/**
 * @fileoverview Pricing math for the pricing examples on Become a League
 * Operator and the Pricing page: the season cost and what it is as a share
 * of the prize pool. Kept apart from
 * the row component so it can be tested on its own.
 *
 *   cost       = teams × weeks × $1 + $10 setup
 *   prize pool = teams × weeks × players × $10 a league night
 *   share      = cost ÷ prize pool, one decimal
 *   week 1     = cost ÷ one week of dues, one decimal
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

/**
 * A ratio as a percent to one decimal, dropping a trailing ".0"
 * (0.42 → "42%", 0.575 → "57.5%").
 */
const percent = (ratio: number) => `${Number((ratio * 100).toFixed(1))}%`;

/** Whole dollars with thousands separators, e.g. 6400 → "$6,400". */
export const dollars = (n: number) => `$${n.toLocaleString('en-US')}`;

/**
 * The cost, prize pool, share, and how soon dues cover the cost, for one
 * example league. Defaults to the Become a League Operator example (5 players
 * × $10 a night); the Pricing page passes its own player count.
 *
 * `paidByWeek` is the first week whose running total of dues
 * (teams × players × $10 per week) reaches the season's whole price. It backs
 * the "week 1 dues cover the entire season" lines on both pages.
 *
 * @param teams - Teams in the league.
 * @param weeks - Regular-season weeks.
 * @param playersPerTeam - Players paying dues on each team (default 5).
 * @param duesPerPlayerNight - What each player pays a league night (default $10).
 * @returns cost, pool and weekly dues in dollars; share as a one-decimal
 *   percent string; weekOneShare as the season cost over one week of dues
 *   (same format); paidByWeek as a week number.
 */
export function seasonPricing(
  teams: number,
  weeks: number,
  playersPerTeam = EXAMPLE_PLAYERS_PER_TEAM,
  duesPerPlayerNight = EXAMPLE_DUES_PER_PLAYER_NIGHT,
) {
  const cost = teams * weeks * PRICE_PER_TEAM_WEEK + SETUP_FEE;
  const weeklyDues = teams * playersPerTeam * duesPerPlayerNight;
  const pool = weeklyDues * weeks;
  return {
    cost,
    pool,
    weeklyDues,
    share: percent(cost / pool),
    weekOneShare: percent(cost / weeklyDues),
    paidByWeek: Math.ceil(cost / weeklyDues),
  };
}
