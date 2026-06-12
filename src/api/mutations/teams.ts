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
import type { Team, TeamInsertData, TeamPlayerInsertData, TeamStatus } from '@/types/team';

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
  /**
   * Optional status change. Used to FILL a bye: when a `status='bye'` team is
   * edited with a captain + name (via the team editor), pass `'active'` to
   * promote it into a real team. Omit to leave status untouched (normal edits).
   */
  status?: TeamStatus;
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
      // Only set status when the caller asks (filling a bye → 'active'); a
      // normal edit omits it so an active team stays active.
      ...(params.status ? { status: params.status } : {}),
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

/**
 * Parameters for converting a real team into the bye.
 */
export interface ConvertTeamToByeParams {
  teamId: string;
  /** Season the team belongs to — used to enforce one bye per season. */
  seasonId: string;
}

/**
 * Convert a real (active) team into THE bye — the pre-season "drop a team"
 * path for a league whose schedule is already generated.
 *
 * When an even league loses a team, the slot count must stay even for the
 * round-robin. Rather than delete the row (which would force a regenerate),
 * we repurpose the dropping team's slot as the bye: it already owns its
 * rotation position, so every "Opponent vs <team>" matchup instantly becomes a
 * bye week — zero match rewiring, no reschedule. This is the exact inverse of
 * fill-the-bye (PR #207).
 *
 * Pre-season ONLY. Guards (all enforced here so the UI and DB agree):
 *   1. The team is currently 'active'.
 *   2. The season has no OTHER bye already (a league holds at most one).
 *   3. None of the team's matches have been played — a mid-season drop must
 *      reconcile real results and is a separate, future flow.
 *
 * Effects: reshape the row to the canonical bye shape (matches createByeTeam —
 * status='bye', captain_id=null, team_name='BYE', home_venue_id=null) and
 * release the roster (the bye has no players). Matches are left untouched.
 *
 * @param params - { teamId, seasonId }
 * @returns The team, now reshaped as the bye
 * @throws Error if a guard fails or a write fails
 */
export async function convertTeamToBye(params: ConvertTeamToByeParams): Promise<Team> {
  const { teamId, seasonId } = params;

  // Guard 1: only an active team can be dropped to a bye.
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('id, status')
    .eq('id', teamId)
    .single();
  if (teamErr || !team) {
    throw new Error(`Failed to load team: ${teamErr?.message ?? 'not found'}`);
  }
  if (team.status !== 'active') {
    throw new Error('Only an active team can be dropped to a BYE.');
  }

  // Guard 2: at most one bye per season.
  const { count: byeCount, error: byeErr } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('status', 'bye');
  if (byeErr) {
    throw new Error(`Failed to check existing byes: ${byeErr.message}`);
  }
  if ((byeCount ?? 0) > 0) {
    throw new Error(
      'This season already has a BYE. Remove the existing BYE first, or regenerate the schedule for an even team count.',
    );
  }

  // Guard 3: pre-season only — refuse if any of the team's matches have been
  // played (started, finished, forfeited, or has a recorded winner).
  const { count: playedCount, error: playedErr } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .or('winner_team_id.not.is.null,status.in.(in_progress,awaiting_verification,completed,forfeited)');
  if (playedErr) {
    throw new Error(`Failed to check played matches: ${playedErr.message}`);
  }
  if ((playedCount ?? 0) > 0) {
    throw new Error(
      'This team has already played matches. Dropping a team mid-season is a separate flow (coming soon) — it must reconcile those results first.',
    );
  }

  // Reshape the row to the canonical bye shape.
  const { data: byeTeam, error: updateErr } = await supabase
    .from('teams')
    .update({ status: 'bye', captain_id: null, team_name: 'BYE', home_venue_id: null })
    .eq('id', teamId)
    .select()
    .single();
  if (updateErr) {
    throw new Error(`Failed to convert team to BYE: ${updateErr.message}`);
  }

  // Release the roster — the bye has no players (they become free agents).
  const { error: rosterErr } = await supabase
    .from('team_players')
    .delete()
    .eq('team_id', teamId);
  if (rosterErr) {
    throw new Error(`Team converted to BYE but clearing its roster failed: ${rosterErr.message}`);
  }

  return byeTeam;
}
