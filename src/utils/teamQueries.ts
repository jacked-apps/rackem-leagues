/**
 * @fileoverview Team Query Utilities
 *
 * Centralized queries for fetching teams with nested relations.
 * Provides consistent data structure across the application.
 */

import { supabase } from '@/supabaseClient';

/**
 * Fetch teams with full details including captain, roster, and venue.
 *
 * Returns active teams only by default. Bye / withdrawn / forfeited rows
 * are filtered out so callers (operator's TeamManagement page,
 * useTeamManagement hook) don't need to remember to filter manually.
 *
 * Returns teams with:
 * - All team fields
 * - Captain member info (name, player numbers)
 * - Full roster with member details
 * - Venue information
 *
 * @param leagueId - The league ID to fetch teams for
 * @param options - { includeInactive } — defaults to false (active-only)
 * @returns Promise with teams data and any error
 */
export async function fetchTeamsWithDetails(
  leagueId: string,
  options: { includeInactive?: boolean } = {}
) {
  const { includeInactive = false } = options;
  let query = supabase
    .from('teams')
    .select(`
      *,
      captain:members!captain_id(
        id,
        first_name,
        last_name,
        phone,
        email,
        system_player_number,
        bca_member_number
      ),
      team_players(
        member_id,
        is_captain,
        members(
          id,
          first_name,
          last_name,
          system_player_number,
          bca_member_number
        )
      ),
      venue:venues(
        id,
        name,
        phone,
        street_address,
        city,
        state
      )
    `)
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  return query;
}
