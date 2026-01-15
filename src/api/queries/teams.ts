/**
 * @fileoverview Team Query Functions (TanStack Query)
 *
 * Pure data-fetching functions for teams and players.
 * These functions are called by TanStack Query hooks, not directly by components.
 *
 * Migrated from:
 * - utils/playerQueries.ts (fetchPlayerTeams, fetchTeamDetails, fetchCaptainTeamEditData)
 * - utils/teamQueries.ts (fetchTeamsWithDetails)
 */

import { supabase } from '@/supabaseClient';

/**
 * Get user's team in a specific match
 *
 * Determines which team (home or away) the user is on for a match.
 * Used by scoring pages to determine user context.
 *
 * @param memberId - Member's primary key ID
 * @param homeTeamId - Home team's primary key ID
 * @param awayTeamId - Away team's primary key ID
 * @returns Object with team_id and isHomeTeam boolean
 * @throws Error if user is not on either team
 *
 * @example
 * const { team_id, isHomeTeam } = await getUserTeamInMatch(memberId, homeTeamId, awayTeamId);
 */
export async function getUserTeamInMatch(
  memberId: string,
  homeTeamId: string,
  awayTeamId: string
): Promise<{ team_id: string; isHomeTeam: boolean }> {
  const { data: teamPlayerData, error: teamPlayerError } = await supabase
    .from('team_players')
    .select('team_id')
    .eq('member_id', memberId)
    .or(`team_id.eq.${homeTeamId},team_id.eq.${awayTeamId}`)
    .single();

  if (teamPlayerError) {
    throw new Error('You are not on either team in this match');
  }

  const userTeam = teamPlayerData.team_id;
  const isHomeTeam = userTeam === homeTeamId;

  return {
    team_id: userTeam,
    isHomeTeam,
  };
}


/**
 * Fetch all teams a player is on across all leagues
 *
 * Returns teams with full details:
 * - Team information (name, stats, status)
 * - League information (game type, day of week)
 * - Season information (name, dates, status)
 * - Captain details
 * - Full roster with all players
 * - Home venue information
 *
 * Only returns teams from active or upcoming seasons by default.
 *
 * @param memberId - The member ID to fetch teams for
 * @returns Promise with teams data
 * @throws Error if query fails
 */
export async function getPlayerTeams(memberId: string) {
  // Fetch all teams for the member
  // Note: Filtering and sorting by nested season status/date must be done client-side
  // as Supabase doesn't support filtering on deeply nested relations
  const { data, error } = await supabase
    .from('team_players')
    .select(`
      team_id,
      teams!inner(
        *,
        season:seasons!inner(
          id,
          season_name,
          start_date,
          end_date,
          status,
          league:leagues!inner(
            id,
            game_type,
            day_of_week,
            division,
            league_start_date
          )
        ),
        captain:members!captain_id(
          id,
          first_name,
          last_name,
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
          name
        )
      )
    `)
    .eq('member_id', memberId);

  if (error) throw error;

  // Filter for active/upcoming seasons and sort by start date (most recent first)
  const filteredData = data
    ?.filter((item: any) => {
      // Type guard: ensure teams and season are objects, not arrays
      const teams = item.teams;
      if (!teams || Array.isArray(teams)) return false;

      const season = teams.season;
      if (!season || Array.isArray(season)) return false;

      const status = season.status;
      return status === 'active' || status === 'upcoming';
    })
    .sort((a: any, b: any) => {
      const teamsA = a.teams;
      const teamsB = b.teams;

      if (!teamsA || Array.isArray(teamsA) || !teamsB || Array.isArray(teamsB)) return 0;

      const seasonA = teamsA.season;
      const seasonB = teamsB.season;

      if (!seasonA || Array.isArray(seasonA) || !seasonB || Array.isArray(seasonB)) return 0;

      const dateA = new Date(seasonA.start_date || 0).getTime();
      const dateB = new Date(seasonB.start_date || 0).getTime();
      return dateB - dateA; // Most recent first
    });

  return filteredData || [];
}

/**
 * Fetch a specific team with full details
 *
 * @param teamId - The team ID to fetch
 * @returns Promise with team data
 * @throws Error if query fails
 */
export async function getTeamDetails(teamId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      season:seasons(
        id,
        season_name,
        start_date,
        end_date,
        status,
        league:leagues(
          id,
          game_type,
          day_of_week,
          division,
          team_format
        )
      ),
      captain:members!captain_id(
        id,
        first_name,
        last_name,
        system_player_number,
        bca_member_number,
        email,
        phone
      ),
      team_players(
        member_id,
        is_captain,
        members(*)
      ),
      venue:venues(
        id,
        name,
        street_address,
        city,
        state
      )
    `)
    .eq('id', teamId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch teams in a league with full details
 *
 * Returns teams with:
 * - All team fields
 * - Captain member info (name, player numbers)
 * - Full roster with member details
 * - Venue information
 *
 * @param leagueId - The league ID to fetch teams for
 * @returns Promise with teams data
 * @throws Error if query fails
 */
export async function getTeamsByLeague(leagueId: string) {
  const { data, error } = await supabase
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
        members(*)
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

  if (error) throw error;
  return data || [];
}

/**
 * Fetch teams in a season with full details
 *
 * @param seasonId - The season ID to fetch teams for
 * @returns Promise with teams data
 * @throws Error if query fails
 */
export async function getTeamsBySeason(seasonId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      captain:members!captain_id(
        id,
        first_name,
        last_name,
        system_player_number,
        bca_member_number
      ),
      team_players(
        member_id,
        is_captain,
        members(*)
      ),
      venue:venues(
        id,
        name
      )
    `)
    .eq('season_id', seasonId);

  if (error) throw error;
  return data || [];
}

/**
 * Get team roster (players on team)
 *
 * Fetches all players on a team from team_players table.
 * Returns captain first, then other players.
 * Used by roster editor when editing existing teams.
 *
 * @param teamId - Team's primary key ID
 * @returns Array of team players with member_id and is_captain flag
 * @throws Error if query fails
 *
 * @example
 * const roster = await getTeamRoster(teamId);
 * const captain = roster.find(p => p.is_captain);
 * const players = roster.filter(p => !p.is_captain);
 */
export async function getTeamRoster(teamId: string) {
  const { data, error } = await supabase
    .from('team_players')
    .select('member_id, is_captain')
    .eq('team_id', teamId)
    .order('is_captain', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Team roster member with details
 * Used for lineup selection dropdowns
 */
export interface TeamRosterMember {
  memberId: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  isCaptain: boolean;
  /** Player's skill level (1-9 BCA scale), used for handicap calculations */
  skillLevel: number | null;
}

/**
 * Fetch team roster with member details
 *
 * Returns team players with their names for display in dropdowns.
 * Used by the match editor for lineup selection.
 *
 * @param teamId - Team's primary key ID
 * @returns Array of team members with names and captain status
 * @throws Error if query fails
 *
 * @example
 * const roster = await getTeamRosterWithDetails(teamId);
 * roster.forEach(member => console.log(`${member.firstName} ${member.lastName}`));
 */
export async function getTeamRosterWithDetails(teamId: string): Promise<TeamRosterMember[]> {
  const { data, error } = await supabase
    .from('team_players')
    .select(`
      is_captain,
      skill_level,
      members:members!team_players_member_id_fkey(
        id,
        first_name,
        last_name,
        nickname
      )
    `)
    .eq('team_id', teamId)
    .order('is_captain', { ascending: false });

  if (error) throw error;

  // Transform to clean interface
  return (data || []).map((p: any) => ({
    memberId: p.members.id,
    firstName: p.members.first_name,
    lastName: p.members.last_name,
    nickname: p.members.nickname,
    isCaptain: p.is_captain,
    skillLevel: p.skill_level,
  }));
}

/**
 * Fetch all data needed for captain to edit their team
 *
 * This includes:
 * - Team details with nested season/league info
 * - All available members (for roster selection)
 * - All venues
 * - League venue assignments
 * - All teams in the season (for duplicate validation)
 *
 * @param teamId - The team ID to fetch editing data for
 * @returns Promise with all necessary data for team editing
 * @throws Error if any query fails
 */
export async function getCaptainTeamEditData(teamId: string) {
  // Fetch team details first to get league/season info
  const team = await getTeamDetails(teamId);

  const leagueId = team.season.league.id;
  const seasonId = team.season.id;

  // Fetch all data in parallel
  const [members, venues, leagueVenues, allTeams] = await Promise.all([
    // Get all members for player selection
    supabase
      .from('members')
      .select('*')
      .order('last_name')
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      }),

    // Get all venues
    supabase
      .from('venues')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      }),

    // Get league venue assignments
    supabase
      .from('league_venues')
      .select('*')
      .eq('league_id', leagueId)
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      }),

    // Get all teams in this season for duplicate validation
    getTeamsBySeason(seasonId),
  ]);

  return {
    team,
    members,
    venues,
    leagueVenues,
    allTeams,
    leagueId,
    seasonId,
    teamFormat: team.season.league.team_format,
  };
}
