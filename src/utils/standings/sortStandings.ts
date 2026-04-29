/**
 * @fileoverview Shared standings-sort helper.
 *
 * Phase 5 Unit 5.3 of the modular-league plan
 * (docs/plans/2026-04-28-001-feat-modular-league-system-plan.md).
 *
 * Until this file existed, the standings sort logic was duplicated in
 * two places:
 *   - src/api/hooks/useStandings.ts (lines 95-108, inline sort)
 *   - src/utils/playoffGenerator.ts (sortStandingsByRank, lines 39-52)
 *
 * Both implemented identically: sort by matchWins → points → gamesWon,
 * all descending. This file consolidates the logic so both call sites
 * delegate here. The `priority` parameter is forward-looking: R10 of the
 * modular plan promotes `standings_sort` to a per-league preference,
 * and downstream PRs will pass the league's resolved priority list.
 *
 * Behavior is locked by characterization tests in
 * src/utils/__tests__/playoffGenerator.standingsSort.characterization.test.ts.
 *
 * Default priority remains [match_wins, games_won, points_earned] —
 * matches today's behavior across all systems. The eventual config
 * value lives in `preferences.standings_sort` (DB column added in
 * 20260429000001_extend_preferences_phase2_modular_axes.sql).
 */

import type { TeamStanding } from '@/api/queries/standings';

/** Allowed sort keys — mirrors the DB CHECK on preferences.standings_sort. */
export type StandingsSortKey = 'match_wins' | 'games_won' | 'points_earned';

/** Default priority list. Wins-first, matching the pre-Phase-5 behavior. */
export const DEFAULT_STANDINGS_SORT_PRIORITY: StandingsSortKey[] = [
  'match_wins',
  'games_won',
  'points_earned',
];

/**
 * Sort a standings array by a configurable priority of sort keys.
 *
 * Returns a NEW array (does not mutate the input). All keys sort
 * descending — the team with the larger value wins each comparison.
 * If two teams tie on every key in the priority list, their relative
 * order is preserved (V8's TimSort is stable).
 *
 * @param standings - The standings to sort
 * @param priority  - Ordered list of sort keys; first key is primary,
 *                    later keys are tiebreakers. Defaults to wins-first.
 *                    Empty arrays use the default priority.
 *
 * @example
 * // Default behavior (wins → games → points)
 * sortStandings(standings);
 *
 * @example
 * // Points-first (e.g., a 5v5 BCA league per the existing TODO at useStandings.ts:91)
 * sortStandings(standings, ['points_earned', 'games_won', 'match_wins']);
 */
export function sortStandings(
  standings: TeamStanding[],
  priority: StandingsSortKey[] = DEFAULT_STANDINGS_SORT_PRIORITY
): TeamStanding[] {
  // Empty priority array means "use default" — gives the column a
  // forgiving migration path (NULL or empty means default).
  const keys =
    priority.length > 0 ? priority : DEFAULT_STANDINGS_SORT_PRIORITY;

  return [...standings].sort((a, b) => {
    for (const key of keys) {
      const aValue = readKey(a, key);
      const bValue = readKey(b, key);
      if (aValue !== bValue) {
        return bValue - aValue; // descending
      }
    }
    // All keys tied — preserve input order (TimSort stable sort).
    return 0;
  });
}

/**
 * Read a sort-key value from a TeamStanding. The key→field mapping is
 * intentional: `match_wins` reads `matchWins`, `points_earned` reads
 * `points`, `games_won` reads `gamesWon`. Locked here so the DB
 * column values stay in lockstep with the runtime field names even
 * though they differ slightly.
 */
function readKey(s: TeamStanding, key: StandingsSortKey): number {
  switch (key) {
    case 'match_wins':
      return s.matchWins;
    case 'games_won':
      return s.gamesWon;
    case 'points_earned':
      return s.points;
    default: {
      // Defensive — the DB CHECK constraint prevents this in practice,
      // but if a stray value ever reaches us, fall back to 0 so the
      // sort doesn't crash. console.warn so the issue surfaces.
      console.warn(`[sortStandings] unknown sort key "${key}" — treating as 0`);
      return 0;
    }
  }
}
