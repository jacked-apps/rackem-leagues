/**
 * @fileoverview Member Search Query Functions
 *
 * Server-side search for members with filtering and limits.
 * Prevents loading all members into memory for large datasets.
 */

import { supabase } from '@/supabaseClient';
import type { PartialMember } from '@/types/member';

export type MemberSearchFilter = 'all' | 'my_org' | 'state' | 'staff';

/**
 * Search for members with server-side filtering
 *
 * Returns top 50 matches based on search query and filter.
 * Searches by name (first/last) and player number.
 *
 * IMPORTANT: Excludes placeholder players (user_id IS NULL) that are already
 * assigned to a team. This prevents captains from "adopting" other teams' PPs,
 * which could cause data integrity issues when the real person registers.
 * Only orphan PPs (not yet on any team) are shown for selection.
 *
 * @param searchQuery - Text to search (name or player number)
 * @param filter - Which subset of members to search
 * @param organizationId - Current user's organization (for 'my_org' filter)
 * @param userState - Current user's state (for 'state' filter)
 * @param limit - Max results to return (default 50)
 * @param registeredOnly - Return only members with a real account.
 *   Placeholder players belong to a league's team structure; a caller outside
 *   that structure (a tournament, which has no org and no teams) has no business
 *   offering them, and the whole assigned-placeholder rule below is meaningless
 *   to it. Setting this also SKIPS the team_players scan entirely, which is a
 *   full-table read this search otherwise does on every keystroke.
 * @returns Array of members matching search criteria
 * @throws Error if database query fails
 *
 * @example
 * const members = await searchMembers('john', 'state', null, 'CA');
 * // Returns up to 50 members named John in California
 */
export async function searchMembers(
  searchQuery: string,
  filter: MemberSearchFilter,
  organizationId: string | null,
  userState: string | null,
  limit: number = 50,
  registeredOnly: boolean = false
): Promise<PartialMember[]> {
  // IDs of placeholder players already on teams, so they can be excluded — a PP
  // belongs to a specific team and shouldn't be "adopted" by another captain.
  //
  // Skipped entirely when the caller wants registered members only: this is a
  // full read of team_players on EVERY search, and a caller with no teams gains
  // nothing from it.
  let assignedPPIds: string[] = [];
  if (!registeredOnly) {
    const { data: assignedPPs, error: ppError } = await supabase
      .from('team_players')
      .select('member_id, members!inner(user_id)')
      .is('members.user_id', null);

    if (ppError) {
      console.error('Failed to fetch assigned PPs:', ppError);
      // Continue without exclusion rather than fail entirely
    }

    assignedPPIds = [...new Set(assignedPPs?.map(tp => tp.member_id) || [])];
  }

  // Handle 'my_org' filter separately since it requires a subquery
  if (filter === 'my_org' && organizationId) {
    // Get members who are on teams in my organization's leagues
    const { data: teamPlayers, error: teamPlayersError } = await supabase
      .from('team_players')
      .select('member_id, teams!inner(season_id, seasons!inner(league_id, leagues!inner(organization_id)))')
      .eq('teams.seasons.leagues.organization_id', organizationId);

    if (teamPlayersError) {
      throw new Error(`Failed to search org members: ${teamPlayersError.message}`);
    }

    // Extract unique member IDs
    const memberIds = [...new Set(teamPlayers?.map(tp => tp.member_id) || [])];

    if (memberIds.length === 0) {
      return []; // No members in this org
    }

    // Now query members table with these IDs
    // Include email to filter PPs without email (they can only be on one team)
    let query = supabase
      .from('members')
      .select('id, first_name, last_name, system_player_number, bca_member_number, state, user_id, email')
      .in('id', memberIds)
      .limit(limit);

    if (registeredOnly) query = query.not('user_id', 'is', null);

    // Apply search if query provided
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      if (/^\d+$/.test(trimmedQuery)) {
        query = query.eq('system_player_number', parseInt(trimmedQuery, 10));
      } else {
        query = query.or(
          `first_name.ilike.%${trimmedQuery}%,last_name.ilike.%${trimmedQuery}%`
        );
      }
    }

    query = query.order('last_name', { ascending: true }).order('first_name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search members: ${error.message}`);
    }

    // Filter out PPs based on rules:
    // - PPs without email: only allowed if NOT already on a team (single-team only)
    // - PPs with email: allowed regardless of team assignment (verified identity)
    // - Real members (user_id not null): always allowed
    const filteredData = (data || []).filter(member => {
      // Keep real members (have user_id)
      if (member.user_id !== null) return true;
      // For PPs (user_id is null):
      // - If they have email, allow (email-protected PP can be on multiple teams)
      if (member.email) return true;
      // - If no email, exclude if already on a team (single-team restriction)
      return !assignedPPIds.includes(member.id);
    });

    // Remove user_id and email from response (not needed by caller)
    return filteredData.map(({ user_id: _unused, email: _email, ...rest }) => rest) as PartialMember[];
  }

  // Standard filters (state, staff, all)
  // Include email to filter PPs without email (they can only be on one team)
  let query = supabase
    .from('members')
    .select('id, first_name, last_name, system_player_number, bca_member_number, state, user_id, email')
    .limit(limit);

  if (registeredOnly) query = query.not('user_id', 'is', null);

  if (filter === 'state' && userState) {
    query = query.eq('state', userState);
  } else if (filter === 'staff') {
    query = query.eq('role', 'league_operator');
  }
  // 'all' filter has no additional conditions

  // Apply search if query provided
  const trimmedQuery = searchQuery.trim();
  if (trimmedQuery) {
    // Check if query is all digits (player number search)
    if (/^\d+$/.test(trimmedQuery)) {
      query = query.eq('system_player_number', parseInt(trimmedQuery, 10));
    } else {
      // Search by name (case-insensitive partial match)
      query = query.or(
        `first_name.ilike.%${trimmedQuery}%,last_name.ilike.%${trimmedQuery}%`
      );
    }
  }
  // If no search query, just return first 50 ordered by name

  // Order by last name, first name
  query = query.order('last_name', { ascending: true }).order('first_name', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to search members: ${error.message}`);
  }

  // Filter out PPs based on rules:
  // - PPs without email: only allowed if NOT already on a team (single-team only)
  // - PPs with email: allowed regardless of team assignment (verified identity)
  // - Real members (user_id not null): always allowed
  const filteredData = (data || []).filter(member => {
    // Keep real members (have user_id)
    if (member.user_id !== null) return true;
    // For PPs (user_id is null):
    // - If they have email, allow (email-protected PP can be on multiple teams)
    if (member.email) return true;
    // - If no email, exclude if already on a team (single-team restriction)
    return !assignedPPIds.includes(member.id);
  });

  // Remove user_id and email from response (not needed by caller)
  return filteredData.map(({ user_id: _unused, email: _email, ...rest }) => rest) as PartialMember[];
}
