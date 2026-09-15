/**
 * @fileoverview The one place the stats feature talks to the database.
 *
 * Everything above this — summary maths, filters, the page — works on
 * `PlayerGameRow[]` and a filter spec, and knows nothing about where the rows
 * came from. That is the entire purpose of the module.
 *
 * Today it loads a player's whole history in one go, which is what makes the
 * filters instant: no request on a filter change, so no spinner on a click.
 * That holds to roughly 10,000 racks (about 15 years of one league night);
 * beyond it the payload gets slow to send even though filtering stays fast.
 *
 * When that day comes, the replacement is `getSummary(filter)` and
 * `getPage(filter)` computed in Postgres, added HERE. Callers keep working on
 * rows and a filter spec, so the change is this file and the query beneath it
 * rather than the feature. Watch for: any one player passing ~10,000 racks, or
 * first load taking over a second on a phone.
 *
 * @see docs/plans/2026-09-06-001-feat-my-stats-page-plan.md
 */

import { fetchPlayerGameHistory } from '@/api/queries/playerGameHistory';
import type { PlayerGameRow } from './playerGameRow';

/**
 * Every rack a player has played, newest first.
 *
 * @param memberId - Whose history to load.
 * @returns Their games as flat rows.
 */
export async function getPlayerHistory(memberId: string): Promise<PlayerGameRow[]> {
  return fetchPlayerGameHistory(memberId);
}

/** Query key for the history, so callers don't hand-write cache keys. */
export function playerHistoryKey(memberId: string): readonly unknown[] {
  return ['playerGameHistory', memberId];
}
