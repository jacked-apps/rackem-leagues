/**
 * @fileoverview Mutation wrapper for the create_season_from_previous RPC.
 *
 * Serializes the wizard state into the RPC's parameter shape and
 * invokes it via supabase-js. Closes Unit 6 of the new-season plan.
 */

import { supabase } from '@/supabaseClient';

export interface CreateSeasonFromPreviousParams {
  leagueId: string;
  previousSeasonId: string;
  seasonName: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  seasonLength: number;
  teams: Array<{
    source_team_id: string;
    captain_id: string;
    team_name: string;
    home_venue_id: string | null;
  }>;
  venueIds: string[];
}

export interface CreateSeasonFromPreviousResult {
  new_season_id: string;
  teams_created: number;
  players_carried: number;
  venues_added: number;
}

export async function createSeasonFromPrevious(
  params: CreateSeasonFromPreviousParams,
): Promise<CreateSeasonFromPreviousResult> {
  const { data, error } = await supabase.rpc('create_season_from_previous', {
    p_league_id: params.leagueId,
    p_previous_season_id: params.previousSeasonId,
    p_season_name: params.seasonName,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_season_length: params.seasonLength,
    p_teams: params.teams,
    p_venue_ids: params.venueIds,
  });

  if (error) {
    throw new Error(
      `Failed to create season from previous: ${error.message}`,
    );
  }

  return data as CreateSeasonFromPreviousResult;
}
