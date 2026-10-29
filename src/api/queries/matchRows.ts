/**
 * @fileoverview Turn a raw `matches` query row into the app's match type.
 *
 * The match queries in matches.ts used to end with a whole-row cast
 * (`data as MatchWithDetails`). That told the type checker to stop checking,
 * so a field missing from a query, or a type that drifted from the database,
 * stayed invisible until it showed up as blank data on screen.
 *
 * This file keeps the checker on for every field except the few where the
 * database types are honestly wider than the app's: text columns guarded by a
 * CHECK constraint, and a JSON column. Only those fields are narrowed here;
 * everything else must already match MatchWithDetails or the build fails.
 */

import type { Json, Tables } from '@/types/database.types';
import type { Match, MatchStatus } from '@/types/schedule';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type { TeamStatus } from '@/types/team';

/** A team embed as the database returns it: status is plain, nullable text. */
interface TeamEmbedRow {
  status: string | null;
}

/** The row fields the database types more loosely than MatchWithDetails. */
type LooseMatchFields = Pick<Tables<'matches'>, 'status' | 'match_result'> & {
  system_snapshot: Json | null;
  home_team: TeamEmbedRow | null;
  away_team: TeamEmbedRow | null;
};

/**
 * Narrow one team embed's status.
 *
 * Safe because the teams status check constraint only allows TEAM_STATUSES,
 * and matchRowNarrowing.db.test.ts fails if the two lists drift apart.
 */
function narrowTeam<T extends TeamEmbedRow>(team: T | null) {
  return team && { ...team, status: team.status as TeamStatus | null };
}

/**
 * Narrow the loosely-typed fields of a match row, leaving the rest untouched
 * (and therefore still checked against MatchWithDetails by the caller's
 * return type).
 *
 * - status / match_result: text columns, limited by CHECK constraints to
 *   MATCH_STATUSES and the three results (matchRowNarrowing.db.test.ts).
 * - system_snapshot: JSON written only by match prep, from a
 *   ResolvedSystemConfig. Same trust every snapshot reader in the app uses.
 *
 * @param row - One row from a `matches` select with home_team/away_team embeds
 * @returns The same row with those fields typed the way the app uses them
 *
 * @example
 * const { data } = await supabase.from('matches').select('*, home_team:..., away_team:...').single();
 * return narrowMatchRow(data); // checked against Promise<MatchWithDetails>
 */
export function narrowMatchRow<R extends LooseMatchFields>(row: R) {
  return {
    ...row,
    status: row.status as MatchStatus,
    match_result: row.match_result as Match['match_result'],
    system_snapshot: row.system_snapshot as ResolvedSystemConfig | null,
    home_team: narrowTeam(row.home_team),
    away_team: narrowTeam(row.away_team),
  };
}

/**
 * Narrow a row and copy its week's date to the top level, for list views
 * that sort and filter by date without digging into season_week.
 *
 * @param row - A match row that also embeds season_week(scheduled_date)
 * @returns The narrowed row plus `scheduled_date` (undefined when no week)
 */
export function narrowMatchRowWithDate<
  R extends LooseMatchFields & { season_week: { scheduled_date: string } | null },
>(row: R) {
  return { ...narrowMatchRow(row), scheduled_date: row.season_week?.scheduled_date || undefined };
}
