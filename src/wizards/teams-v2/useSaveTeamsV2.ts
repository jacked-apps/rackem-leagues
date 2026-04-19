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
      // Fetch venue details so we can pull each venue's table numbers
      const { data: venues, error: venueFetchError } = await supabase
        .from('venues')
        .select('id, bar_box_table_numbers, eight_foot_table_numbers, regulation_table_numbers')
        .in('id', venueIds);

      if (venueFetchError) {
        throw new Error(`Failed to fetch venues: ${venueFetchError.message}`);
      }

      // Insert league_venues rows (one per selected venue)
      for (const venue of venues ?? []) {
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
