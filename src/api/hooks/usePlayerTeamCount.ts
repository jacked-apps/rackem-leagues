/**
 * @fileoverview usePlayerTeamCount Hook
 *
 * Fetches the count of teams a player belongs to.
 * Used by InvitePlayerModal and ClaimPlayer to show how many teams
 * the placeholder player is on.
 *
 * @example
 * const { teamCount, teams, loading } = usePlayerTeamCount(memberId);
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

/** Team info returned from the query */
export interface PlayerTeam {
  team_id: string;
  team_name: string;
}

/**
 * Fetch teams a player belongs to
 */
async function fetchPlayerTeams(memberId: string): Promise<PlayerTeam[]> {
  const { data, error } = await supabase
    .from('team_players')
    .select(`
      team_id,
      teams (
        id,
        team_name
      )
    `)
    .eq('member_id', memberId);

  if (error) {
    console.error('Error fetching player teams:', error);
    throw error;
  }

  // Transform the nested data structure
  // flatMap rather than filter+map so TypeScript keeps the narrowing on
  // `tp.teams` (a filter callback doesn't carry it into the map).
  return (data || []).flatMap((tp) =>
    tp.teams && !Array.isArray(tp.teams)
      ? [{ team_id: tp.teams.id, team_name: tp.teams.team_name }]
      : []
  );
}

/**
 * Hook to get the count and list of teams a player belongs to
 *
 * @param memberId - The member ID to fetch team count for
 * @param enabled - Whether to enable the query (defaults to true when memberId exists)
 * @returns Object with teams list, count, and loading state
 */
export function usePlayerTeamCount(memberId: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ['playerTeams', memberId],
    queryFn: () => fetchPlayerTeams(memberId!),
    enabled: !!memberId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const teams = query.data || [];

  return {
    /** List of teams the player belongs to */
    teams,
    /** Number of teams the player belongs to */
    teamCount: teams.length,
    /** Whether more than one team exists */
    hasMultipleTeams: teams.length > 1,
    /** Loading state */
    loading: query.isLoading,
    /** Error state */
    error: query.error,
    /** Refetch function */
    refetch: query.refetch,
  };
}
