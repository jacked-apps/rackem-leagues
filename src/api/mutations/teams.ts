/**
 * @fileoverview Team Mutation Functions
 *
 * Pure functions for team create/update/delete operations.
 * These functions are wrapped by TanStack Query mutation hooks.
 *
 * Teams are associated with a season and league. Each team has:
 * - A captain (member_id)
 * - A roster of players (team_players table)
 * - Optional home venue
 * - Stats (wins, losses, points, etc.)
 *
 * @see api/hooks/useTeamMutations.ts - Mutation hooks that wrap these functions
 */

import { supabase } from '@/supabaseClient';
import type { Team, TeamInsertData, TeamPlayerInsertData } from '@/types/team';

/**
 * Parameters for creating a new team
 */
export interface CreateTeamParams {
  seasonId: string;
  leagueId: string;
  captainId: string;
  teamName: string;
  rosterSize: number;
  homeVenueId?: string | null;
  rosterPlayerIds: string[]; // Array of member IDs to add to roster
}

/**
 * Parameters for updating an existing team
 */
export interface UpdateTeamParams {
  teamId: string;
  seasonId: string;
  captainId: string;
  teamName: string;
  homeVenueId?: string | null;
  rosterPlayerIds: string[]; // Complete roster to sync
  isCaptainVariant?: boolean; // If true, preserves captain row during roster sync
}

/**
 * Parameters for deleting a team
 */
export interface DeleteTeamParams {
  teamId: string;
}

/**
 * Create a new team with roster
 *
 * This creates both the team record and all team_players roster records
 * in a transaction-like operation (if one fails, both should fail).
 *
 * @param params - Team creation parameters
 * @returns The newly created team
 * @throws Error if validation fails or database operation fails
 */
export async function createTeam(params: CreateTeamParams): Promise<Team> {
  // Validation
  if (!params.teamName.trim()) {
    throw new Error('Team name is required');
  }

  if (!params.captainId) {
    throw new Error('Captain is required');
  }

  if (params.rosterSize < 2 || params.rosterSize > 20) {
    throw new Error('Roster size must be between 2 and 20');
  }

  if (params.rosterPlayerIds.length === 0) {
    throw new Error('Team must have at least one player');
  }

  if (!params.rosterPlayerIds.includes(params.captainId)) {
    throw new Error('Captain must be included in roster');
  }

  // Create team record
  const teamData: TeamInsertData = {
    season_id: params.seasonId,
    league_id: params.leagueId,
    captain_id: params.captainId,
    home_venue_id: params.homeVenueId || null,
    team_name: params.teamName.trim(),
    roster_size: params.rosterSize,
  };

  const { data: newTeam, error: teamError } = await supabase
    .from('teams')
    .insert([teamData])
    .select()
    .single();

  if (teamError) {
    throw new Error(`Failed to create team: ${teamError.message}`);
  }

  // Create roster records
  const rosterData: TeamPlayerInsertData[] = params.rosterPlayerIds.map((memberId) => ({
    team_id: newTeam.id,
    member_id: memberId,
    season_id: params.seasonId,
    is_captain: memberId === params.captainId,
    skill_level: null, // Skill level will be set later by team captain
  }));

  const { error: rosterError } = await supabase
    .from('team_players')
    .insert(rosterData);

  if (rosterError) {
    // If roster insert fails, we should ideally rollback the team creation
    // but Supabase doesn't support transactions directly
    // For now, throw error and let caller handle cleanup if needed
    throw new Error(`Failed to create team roster: ${rosterError.message}`);
  }

  return newTeam;
}

/**
 * Update an existing team
 *
 * This updates the team record AND synchronizes the roster:
 * - Deletes old roster entries (except captain in captain variant)
 * - Inserts new roster entries
 *
 * @param params - Team update parameters
 * @returns The updated team
 * @throws Error if validation fails or database operation fails
 */
export async function updateTeam(params: UpdateTeamParams): Promise<Team> {
  // Validation
  if (!params.teamName.trim()) {
    throw new Error('Team name is required');
  }

  if (!params.captainId) {
    throw new Error('Captain is required');
  }

  if (params.rosterPlayerIds.length === 0) {
    throw new Error('Team must have at least one player');
  }

  if (!params.rosterPlayerIds.includes(params.captainId)) {
    throw new Error('Captain must be included in roster');
  }

  // Update team record
  const { data: updatedTeam, error: teamError } = await supabase
    .from('teams')
    .update({
      captain_id: params.captainId,
      home_venue_id: params.homeVenueId || null,
      team_name: params.teamName.trim(),
    })
    .eq('id', params.teamId)
    .select()
    .single();

  if (teamError) {
    throw new Error(`Failed to update team: ${teamError.message}`);
  }

  // Sync roster - get current roster first
  const { data: currentRoster, error: fetchError } = await supabase
    .from('team_players')
    .select('member_id, is_captain')
    .eq('team_id', params.teamId);

  if (fetchError) {
    throw new Error(`Failed to fetch current roster: ${fetchError.message}`);
  }

  // Handle captain variant (captain row protected by RLS)
  if (params.isCaptainVariant && currentRoster) {
    const captainRow = currentRoster.find(r => r.is_captain);

    if (captainRow) {
      // Update captain's is_captain flag if needed
      await supabase
        .from('team_players')
        .update({ is_captain: captainRow.member_id === params.captainId })
        .eq('team_id', params.teamId)
        .eq('member_id', captainRow.member_id);

      // Delete only non-captain rows
      const { error: deleteError } = await supabase
        .from('team_players')
        .delete()
        .eq('team_id', params.teamId)
        .neq('member_id', captainRow.member_id);

      if (deleteError) {
        throw new Error(`Failed to delete roster: ${deleteError.message}`);
      }
    }
  } else {
    // Operator variant - delete all roster rows
    const { error: deleteError } = await supabase
      .from('team_players')
      .delete()
      .eq('team_id', params.teamId);

    if (deleteError) {
      throw new Error(`Failed to delete roster: ${deleteError.message}`);
    }
  }

  // Prepare new roster (remove duplicates)
  const uniquePlayerIds = [...new Set(params.rosterPlayerIds)];

  // Filter out captain if captain variant and they already exist
  let playersToInsert = uniquePlayerIds;
  if (params.isCaptainVariant && currentRoster) {
    const captainRow = currentRoster.find(r => r.is_captain);
    if (captainRow) {
      playersToInsert = uniquePlayerIds.filter(id => id !== captainRow.member_id);
    }
  }

  // Insert new roster
  if (playersToInsert.length > 0) {
    const rosterData: TeamPlayerInsertData[] = playersToInsert.map((memberId) => ({
      team_id: params.teamId,
      member_id: memberId,
      season_id: params.seasonId,
      is_captain: memberId === params.captainId,
      skill_level: null, // Skill level will be set later by team captain
    }));

    const { error: insertError } = await supabase
      .from('team_players')
      .insert(rosterData);

    if (insertError) {
      throw new Error(`Failed to insert roster: ${insertError.message}`);
    }
  }

  return updatedTeam;
}

/**
 * Parameters for creating a bye-team row.
 */
export interface CreateByeTeamParams {
  seasonId: string;
  leagueId: string;
  rosterSize: number;
  /**
   * Display name for the bye row. Defaults to 'BYE' for original
   * schedule-generation byes; the drop_team RPC (PR 2) uses descriptive
   * names like 'BYE — replaced Sharks wk 6' for drop-created byes.
   */
  teamName?: string;
}

/**
 * Create a bye-team row for a season.
 *
 * Bye teams are placeholders used when the schedule has an odd number of
 * real teams, OR (after PR 2) when a real team is dropped mid-season and
 * its scheduled matches are reassigned to a fresh bye slot. They have:
 *   - status = 'bye'
 *   - captain_id = NULL (the column is nullable as of PR 1 Unit 1.1)
 *   - no team_players (no roster)
 *
 * Bye rows are filtered out of active team lists by the read-side helpers
 * in `src/api/queries/teams.ts` (use `includeInactive: true` to opt in).
 *
 * @param params - Bye-team parameters
 * @returns The newly created bye team row
 * @throws Error if database operation fails
 */
export async function createByeTeam(params: CreateByeTeamParams): Promise<Team> {
  const { data: byeTeam, error } = await supabase
    .from('teams')
    .insert({
      season_id: params.seasonId,
      league_id: params.leagueId,
      captain_id: null,
      team_name: params.teamName ?? 'BYE',
      roster_size: params.rosterSize,
      status: 'bye',
      home_venue_id: null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create bye team: ${error.message}`);
  }

  return byeTeam;
}

/**
 * Parameters for dropping a team mid-season.
 */
export interface DropTeamParams {
  teamId: string;
  /**
   * Caller's member id. Cross-checked against auth.uid() inside the RPC
   * to prevent impersonation; included so the RPC can record who acted
   * in any future audit log.
   */
  actorMemberId: string;
}

/**
 * Result returned by the drop_team RPC.
 */
export interface DropTeamResult {
  newByeTeamId: string;
  matchesReassigned: number;
  matchesForfeited: number;
}

/**
 * Drop a team mid-season via the drop_team Postgres RPC.
 *
 * The RPC is atomic: marks the team withdrawn, clears the roster,
 * creates a fresh bye row to absorb future matches, forfeits past-due
 * matches the bye now owns, and cancels pending invites — all in one
 * transaction with a row lock and idempotency check.
 *
 * @throws Error with the RPC's error_message on validation/auth failure.
 */
export async function dropTeam(params: DropTeamParams): Promise<DropTeamResult> {
  const { data, error } = await supabase.rpc('drop_team', {
    p_team_id: params.teamId,
    p_actor_member_id: params.actorMemberId,
  });

  if (error) {
    throw new Error(`drop_team RPC failed: ${error.message}`);
  }

  // RPC returns RETURNS TABLE(...), so data is an array (length 1).
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || !row.success) {
    throw new Error(row?.error_message ?? 'Drop failed');
  }

  return {
    newByeTeamId: row.new_bye_team_id,
    matchesReassigned: row.matches_reassigned,
    matchesForfeited: row.matches_forfeited,
  };
}

/**
 * Parameters for replacing a bye / withdrawn slot with a new active team.
 */
export interface ReplaceTeamParams {
  /** Season the new team joins. */
  seasonId: string;
  /** League the new team belongs to. */
  leagueId: string;
  /** Captain member id for the new team. */
  captainId: string;
  /** Display name for the new team. */
  teamName: string;
  /** Roster size (5 or 8). */
  rosterSize: number;
  /** Optional home venue for the new team. */
  homeVenueId?: string | null;
  /** Member ids to add to the new team's roster (must include captainId). */
  rosterPlayerIds: string[];
  /** The bye / withdrawn team whose remaining matches transfer to the new team. */
  replacingTeamId: string;
}

/**
 * Replace a bye / withdrawn slot with a brand-new active team.
 *
 * Multi-step orchestration (no DB transaction wrapping the two calls — at
 * v1 the LO won't race themselves; if cross-call failure modes become a
 * problem, promote this to a single Postgres RPC):
 *   1. createTeam — inserts the new active team row plus its roster.
 *   2. UPDATE matches.home_team_id / away_team_id from the
 *      bye/withdrawn row to the new team for status IN
 *      ('scheduled', 'postponed'). Existing
 *      trigger_sync_match_lineups_on_update propagates to match_lineups.
 *
 * The bye/withdrawn row stays as a frozen historical artifact — it
 * owns whatever matches the LO chose NOT to reassign (locked-in forfeit
 * losses) plus any past completed matches if the row was a dropped
 * real team.
 */
export async function replaceTeam(params: ReplaceTeamParams): Promise<Team> {
  const newTeam = await createTeam({
    seasonId: params.seasonId,
    leagueId: params.leagueId,
    captainId: params.captainId,
    teamName: params.teamName,
    rosterSize: params.rosterSize,
    homeVenueId: params.homeVenueId,
    rosterPlayerIds: params.rosterPlayerIds,
  });

  const { error: homeError } = await supabase
    .from('matches')
    .update({ home_team_id: newTeam.id })
    .eq('home_team_id', params.replacingTeamId)
    .in('status', ['scheduled', 'postponed']);

  if (homeError) {
    throw new Error(`Failed to reassign home matches to new team: ${homeError.message}`);
  }

  const { error: awayError } = await supabase
    .from('matches')
    .update({ away_team_id: newTeam.id })
    .eq('away_team_id', params.replacingTeamId)
    .in('status', ['scheduled', 'postponed']);

  if (awayError) {
    throw new Error(`Failed to reassign away matches to new team: ${awayError.message}`);
  }

  return newTeam;
}

/**
 * Delete a team (soft delete by setting status to 'withdrawn')
 *
 * This does NOT delete team_players records - they remain for historical data.
 * Only the team status is changed to 'withdrawn'.
 *
 * @param params - Team deletion parameters
 * @returns The updated (withdrawn) team
 * @throws Error if database operation fails
 */
export async function deleteTeam(params: DeleteTeamParams): Promise<Team> {
  const { data: withdrawnTeam, error } = await supabase
    .from('teams')
    .update({ status: 'withdrawn' })
    .eq('id', params.teamId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to withdraw team: ${error.message}`);
  }

  return withdrawnTeam;
}
