/**
 * @fileoverview useSaveTeamsV2 — saves league venues and teams for the wizard
 *
 * Part of the "Create New League" flow. Given the selected venue IDs and
 * a list of captains, this hook:
 *   1. Inserts a league_venues row for each selected venue (using ALL of
 *      the venue's table numbers as the league's available tables).
 *   2. Inserts one team per captain, with the captain as the only roster
 *      member. The LO can expand the roster later via Team Management.
 *
 * Uses the shared `addLeagueVenue` and `createTeam` mutation functions so
 * the same validation and shape applies here as in the legacy flows.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { addLeagueVenue } from '@/api/mutations/leagueVenues';
import { createTeam } from '@/api/mutations/teams';
import type { TeamCaptainEntry } from './teamsWizardTypes';

interface SaveTeamsArgs {
  leagueId: string;
  seasonId: string;
  maxRosterSize: number; // from resolved league preferences
  venueIds: string[];
  captains: TeamCaptainEntry[];
}

export function useSaveTeamsV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leagueId,
      seasonId,
      maxRosterSize,
      venueIds,
      captains,
    }: SaveTeamsArgs) => {
      // Hard guard against the "advance with zero teams" failure mode.
      // The captains editor has its own min-4 validate, but the Keep
      // path on the captains-mode gate can produce an empty captains
      // array if previous-season data didn't have resolvable captain
      // IDs (e.g., bug-state where currentCaptainId is null). Without
      // this guard the for-loop below iterates zero times, returns
      // teams=[], and the wizard happily advances to Matchups with no
      // teams in DB.
      if (!captains || captains.length === 0) {
        throw new Error(
          'No captains to save. A season needs at least one team; nothing was created.',
        );
      }

      // Fetch venue details so we can pull each venue's table numbers
      const { data: venues, error: venueFetchError } = await supabase
        .from('venues')
        .select('id, bar_box_table_numbers, eight_foot_table_numbers, regulation_table_numbers')
        .in('id', venueIds);

      if (venueFetchError) {
        throw new Error(`Failed to fetch venues: ${venueFetchError.message}`);
      }

      // Sync `league_venues` to match the operator's selection:
      //   - venues in selection that aren't linked yet → INSERT
      //   - venues currently linked that aren't in selection → DELETE
      // The unchecking case matters: if an operator removes a venue
      // from this league's pool, captains picking their home venue
      // later in the season should NOT see it. Leaving stale links
      // around would let captains pick a venue the operator just
      // told them isn't hosting league anymore.
      const { data: existingLinks } = await supabase
        .from('league_venues')
        .select('venue_id')
        .eq('league_id', leagueId);
      const alreadyLinked = new Set(
        (existingLinks ?? []).map((v: { venue_id: string }) => v.venue_id),
      );
      const selected = new Set(venueIds);
      const venueIdsToRemove = Array.from(alreadyLinked).filter(
        (id) => !selected.has(id),
      );

      // Insert league_venues rows (one per NEW selected venue)
      for (const venue of venues ?? []) {
        if (alreadyLinked.has(venue.id)) continue;
        const allTables = [
          ...(venue.bar_box_table_numbers ?? []),
          ...(venue.eight_foot_table_numbers ?? []),
          ...(venue.regulation_table_numbers ?? []),
        ];
        await addLeagueVenue({
          leagueId,
          venueId: venue.id,
          availableTableNumbers: allTables,
          capacity: allTables.length,
        });
      }

      // Remove league_venues rows for venues the operator unchecked.
      // Previous-season teams keep their existing home_venue_id (it's
      // a FK to `venues`, not `league_venues`), so deactivating the
      // link doesn't break historical data — it just removes the
      // venue from this league's future selection pool.
      if (venueIdsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('league_venues')
          .delete()
          .eq('league_id', leagueId)
          .in('venue_id', venueIdsToRemove);
        if (deleteError) {
          throw new Error(`Failed to remove unselected venues: ${deleteError.message}`);
        }
      }

      // Insert one team per captain (captain-only roster).
      // If there's only one venue, every team has to play there — auto-assign
      // it as the home venue. With 2+ venues, leave home_venue_id blank so the
      // operator can decide per-team later via Team Management.
      const defaultHomeVenueId = venueIds.length === 1 ? venueIds[0] : null;
      const createdTeams: { teamId: string; teamName: string }[] = [];
      for (const captain of captains) {
        const team = await createTeam({
          seasonId,
          leagueId,
          captainId: captain.captainId,
          teamName: captain.teamName.trim() || `Team ${createdTeams.length + 1}`,
          rosterSize: maxRosterSize,
          homeVenueId: defaultHomeVenueId,
          rosterPlayerIds: [captain.captainId],
        });
        createdTeams.push({ teamId: team.id, teamName: team.team_name });
      }

      return { venueCount: venues?.length ?? 0, teams: createdTeams };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['league_venues'] });
      queryClient.invalidateQueries({ queryKey: ['flow-stage-detection'] });
    },
  });
}
