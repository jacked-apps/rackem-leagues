/**
 * @fileoverview Team Hooks (TanStack Query)
 *
 * React hooks for fetching team data with automatic caching.
 * Replaces old utils/playerQueries.ts and utils/teamQueries.ts patterns.
 *
 * Benefits:
 * - Automatic caching (10 minute stale time)
 * - Background refetching
 * - Request deduplication
 * - Loading and error states
 *
 * @example
 * const { data: teams, isLoading } = usePlayerTeams(memberId);
 * const { data: team } = useTeamDetails(teamId);
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  getPlayerTeams,
  getTeamDetails,
  getTeamsByLeague,
  getTeamsBySeason,
  getCaptainTeamEditData,
  getUserTeamInMatch,
  getTeamRoster,
  getTeamRosterWithDetails,
} from '../queries/teams';
import { STALE_TIME } from '../client';

/**
 * Hook to fetch all teams a player is on
 *
 * Returns teams with full details including season, league, roster, and venue.
 * Only includes teams from active or upcoming seasons.
 *
 * @param memberId - The member ID to fetch teams for
 * @returns TanStack Query result with teams data
 *
 * @example
 * const { data: teams, isLoading, error } = usePlayerTeams(memberId);
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error loading teams</div>;
 *
 * teams.forEach(team => {
 *   console.log(team.teams.team_name);
 * });
 */
export function usePlayerTeams(memberId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.byMember(memberId || ''),
    queryFn: () => getPlayerTeams(memberId!),
    enabled: !!memberId,
    staleTime: STALE_TIME.TEAMS,
    refetchOnMount: 'always', // Always refetch when navigating to My Teams page
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch a specific team with full details
 *
 * Includes season, league, captain, roster, and venue information.
 *
 * @param teamId - The team ID to fetch
 * @returns TanStack Query result with team data
 *
 * @example
 * const { data: team, isLoading } = useTeamDetails(teamId);
 *
 * if (team) {
 *   console.log(team.team_name);
 *   console.log(team.captain.first_name);
 *   console.log(team.season.league.game_type);
 * }
 */
export function useTeamDetails(teamId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.detail(teamId || ''),
    queryFn: () => getTeamDetails(teamId!),
    enabled: !!teamId,
    staleTime: STALE_TIME.TEAMS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch all teams in a league
 *
 * @param leagueId - The league ID to fetch teams for
 * @returns TanStack Query result with teams data
 *
 * @example
 * const { data: teams } = useTeamsByLeague(leagueId);
 */
export function useTeamsByLeague(leagueId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.byLeague(leagueId || ''),
    queryFn: () => getTeamsByLeague(leagueId!),
    enabled: !!leagueId,
    staleTime: STALE_TIME.TEAMS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch all teams in a season
 *
 * @param seasonId - The season ID to fetch teams for
 * @returns TanStack Query result with teams data
 *
 * @example
 * const { data: teams } = useTeamsBySeason(seasonId);
 */
export function useTeamsBySeason(seasonId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.bySeason(seasonId || ''),
    queryFn: () => getTeamsBySeason(seasonId!),
    enabled: !!seasonId,
    staleTime: STALE_TIME.TEAMS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch all data needed for captain to edit their team
 *
 * Returns:
 * - Team details
 * - All available members
 * - All venues
 * - League venue assignments
 * - All teams in the season
 *
 * @param teamId - The team ID to fetch editing data for
 * @returns TanStack Query result with complete edit data
 *
 * @example
 * const { data: editData, isLoading } = useCaptainTeamEditData(teamId);
 *
 * if (editData) {
 *   const { team, members, venues, leagueVenues, allTeams } = editData;
 * }
 */
export function useCaptainTeamEditData(teamId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.teams.detail(teamId || ''), 'edit'] as const,
    queryFn: () => getCaptainTeamEditData(teamId!),
    enabled: !!teamId,
    staleTime: STALE_TIME.TEAMS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get user's team in a specific match
 *
 * Determines which team (home or away) the user is on for a match.
 * Used by scoring pages to determine user context.
 * Cached for 10 minutes (team membership doesn't change during match).
 *
 * @param memberId - Member's primary key ID
 * @param homeTeamId - Home team's primary key ID
 * @param awayTeamId - Away team's primary key ID
 * @returns TanStack Query result with { team_id, isHomeTeam }
 *
 * @example
 * const { data, isLoading } = useUserTeamInMatch(memberId, homeTeamId, awayTeamId);
 * if (data) {
 *   console.log(`User is on ${data.isHomeTeam ? 'home' : 'away'} team`);
 * }
 */
export function useUserTeamInMatch(
  memberId: string | null | undefined,
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined
) {
  return useQuery({
    queryKey: ['userTeamInMatch', memberId, homeTeamId, awayTeamId],
    queryFn: () => getUserTeamInMatch(memberId!, homeTeamId!, awayTeamId!),
    enabled: !!memberId && !!homeTeamId && !!awayTeamId,
    staleTime: STALE_TIME.TEAMS, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch team roster (all players on team)
 *
 * Returns team_players records with member_id and is_captain flag.
 * Captain is returned first, then other players.
 * Used by roster editor when loading existing team data.
 * Cached for 10 minutes.
 *
 * @param teamId - Team's primary key ID
 * @returns TanStack Query result with roster data
 *
 * @example
 * const { data: roster, isLoading } = useTeamRoster(teamId);
 * if (roster) {
 *   const captain = roster.find(p => p.is_captain);
 *   const players = roster.filter(p => !p.is_captain);
 * }
 */
export function useTeamRoster(teamId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.teams.detail(teamId || ''), 'roster'],
    queryFn: () => getTeamRoster(teamId!),
    enabled: !!teamId,
    staleTime: STALE_TIME.TEAMS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch team roster with member details
 *
 * Returns team players with names for display in dropdowns.
 * Used by match editor for lineup selection.
 *
 * @param teamId - Team ID to fetch roster for
 * @returns Query result with array of TeamRosterMember objects
 *
 * @example
 * const { data: roster, isLoading } = useTeamRosterWithDetails(teamId);
 * roster?.map(m => `${m.firstName} ${m.lastName}`)
 */
export function useTeamRosterWithDetails(teamId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.teams.detail(teamId || ''), 'rosterWithDetails'],
    queryFn: () => getTeamRosterWithDetails(teamId!),
    enabled: !!teamId,
    staleTime: STALE_TIME.TEAMS,
    refetchOnWindowFocus: false,
  });
}
