/**
 * @fileoverview Income + green-fee + app-fee calculators.
 *
 * Pure functions, no DB, no React. The whole math engine is built so
 * any caller (UI components, tests, future export tools) can ask
 * "given these inputs, what's the number?" and get a deterministic
 * answer.
 *
 * Per the brainstorm: the team is the unit of payment obligation
 * (not the individual player). A 5-man team owes 5 × price per
 * night regardless of how many players showed up. The formula is
 * exact, not an estimate.
 */

import type { DroppedTeam } from './types';

/**
 * Projected total income for the entire regular season, accounting
 * for any teams that dropped mid-season (lose income from the drop
 * week forward).
 *
 * Formula:
 *   base    = price × lineup × team_count × total_weeks
 *   penalty = price × lineup × Σ (total_weeks − dropped_at_week + 1)
 *                                 for each dropped team
 *                  (i.e., they would have paid for the weeks they
 *                   no longer participated in)
 *   income  = base − penalty
 *
 * Drop semantics: `droppedAtWeek` is the week the team STOPPED
 * playing. They paid for weeks 1 through (droppedAtWeek − 1) and
 * owe nothing for week droppedAtWeek through total_weeks.
 *
 * Wait — re-reading the brainstorm: the team is the obligation unit
 * regardless of who shows up. Forfeit = team still owes for that
 * night. Drop = team is GONE, leaves the league, no more obligation
 * from then on. So a team that drops at week 6 paid weeks 1-5 (they
 * played those nights) and owes nothing from week 6 onward.
 *
 * @returns total dollars expected to be collected over the full season
 */
export function computeProjectedIncome(args: {
  pricePerPlayerPerNight: number;
  lineupSize: number;
  teamCount: number;
  totalWeeks: number;
  droppedTeams?: DroppedTeam[];
}): number {
  const { pricePerPlayerPerNight, lineupSize, teamCount, totalWeeks } = args;
  const droppedTeams = args.droppedTeams ?? [];

  const baseIncome =
    pricePerPlayerPerNight * lineupSize * teamCount * totalWeeks;

  // Each dropped team loses (totalWeeks - droppedAtWeek + 1) weeks
  // of income. Per-team penalty = price × lineup × lost_weeks.
  // Worked example: 12-week season, team drops at week 6 → they
  // paid weeks 1-5, they owe nothing for weeks 6-12 = 7 lost weeks.
  // (12 - 6 + 1) = 7. ✓
  const droppedPenalty = droppedTeams.reduce((acc, drop) => {
    const lostWeeks = Math.max(0, totalWeeks - drop.droppedAtWeek + 1);
    return acc + pricePerPlayerPerNight * lineupSize * lostWeeks;
  }, 0);

  return Math.max(0, baseIncome - droppedPenalty);
}

/**
 * Projected total green fees paid to the venue over the season.
 * Same shape as income but with green-fee multiplier.
 */
export function computeProjectedGreenFees(args: {
  greenFeePerPlayerPerNight: number;
  lineupSize: number;
  teamCount: number;
  totalWeeks: number;
  droppedTeams?: DroppedTeam[];
}): number {
  const { greenFeePerPlayerPerNight, lineupSize, teamCount, totalWeeks } = args;
  const droppedTeams = args.droppedTeams ?? [];

  const baseGreen =
    greenFeePerPlayerPerNight * lineupSize * teamCount * totalWeeks;

  const droppedPenalty = droppedTeams.reduce((acc, drop) => {
    const lostWeeks = Math.max(0, totalWeeks - drop.droppedAtWeek + 1);
    return acc + greenFeePerPlayerPerNight * lineupSize * lostWeeks;
  }, 0);

  return Math.max(0, baseGreen - droppedPenalty);
}

/**
 * The app's fee for running this season. Pulled from the proposed
 * pricing on `src/leagueOperator/BecomeLeagueOperator.tsx`:
 *   $1 per team per week + $10 setup per season
 *
 * Fully computable from data the app already has — no LO input.
 */
export function computeAppFee(args: {
  teamCount: number;
  totalWeeks: number;
}): number {
  return args.teamCount * args.totalWeeks * 1 + 10;
}
