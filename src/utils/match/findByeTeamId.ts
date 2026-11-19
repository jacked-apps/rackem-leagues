/**
 * @fileoverview Find a season's BYE team from its schedule.
 *
 * A BYE is a real team row with `status='bye'` (see `isByeMatch`). The week
 * editor offers it as the "BYE" choice, but the editor's team list is
 * active-only, so the bye team's id has to come from somewhere else. The
 * schedule's matches already carry each side's `status`, so it's read from
 * there, with no extra query.
 */

/** One side of a match, as the schedule queries return it (id + status). */
type ScheduleTeam = { id: string; status?: string | null } | null | undefined;

/**
 * The minimal schedule shape this reads: weeks with matches that carry each
 * side's team. Structural, so it accepts both schedule types the app has
 * (`api/queries/matches` and `types/schedule`).
 */
type ScheduleWithTeams = ReadonlyArray<{
  matches: ReadonlyArray<{ home_team?: ScheduleTeam; away_team?: ScheduleTeam }>;
}>;

/**
 * The id of the season's BYE team, or null if the schedule has none.
 *
 * Judged by team STATUS, never by an empty team slot. Empty slots were the old
 * way to mark a bye; they were backfilled to real bye rows in
 * `20260501000004_backfill_null_bye_matches.sql`. An empty slot today means a
 * playoff "to be decided" team, not a bye.
 *
 * @param schedule - The season schedule (weeks with their matches)
 * @returns The bye team's id, or null when no match includes a bye team
 */
export function findByeTeamId(schedule: ScheduleWithTeams): string | null {
  for (const { matches } of schedule) {
    for (const match of matches) {
      if (match.home_team?.status === 'bye') return match.home_team.id;
      if (match.away_team?.status === 'bye') return match.away_team.id;
    }
  }
  return null;
}
