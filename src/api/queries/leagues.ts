/**
 * @fileoverview League Query Functions
 *
 * Pure data fetching functions for league-related queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 *
 * @see api/hooks/useLeagues.ts - React hook wrapper
 */

import { supabase } from '@/supabaseClient';
import type { League } from '@/types/league';

/**
 * League progress data structure
 * Tracks completion status of league setup and active season progress
 */
export interface LeagueProgress {
  seasonCount: number;
  teamCount: number;
  playerCount: number;
  scheduleExists: boolean;
  activeSeason: any | null;
  completedWeeks: number;
  totalWeeks: number;
  /** True if this league has a season with status='scheduled' (wizard
   *  finished but start_date hasn't arrived yet). Used by
   *  isNextSeasonRipe to hide the "Create Next Season" CTA — that
   *  next season already exists. */
  hasScheduledSeason: boolean;
}

/**
 * League with embedded progress data
 */
export interface LeagueWithProgress extends League {
  _progress?: LeagueProgress;
}

/**
 * Fetch all leagues for an operator
 *
 * Gets basic league data without progress calculations.
 * Used for simple league lists and dropdowns.
 *
 * @param operatorId - Operator's primary key ID
 * @returns Array of leagues ordered by creation date (newest first)
 * @throws Error if database query fails
 *
 * @example
 * const leagues = await getLeaguesByOperator('operator-uuid');
 * leagues.forEach(league => console.log(league.game_type, league.day_of_week));
 */
export async function getLeaguesByOperator(operatorId: string): Promise<League[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('organization_id', operatorId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch leagues: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch count of leagues for an operator
 *
 * Efficient count-only query for dashboard stats.
 * Doesn't fetch full league data.
 *
 * @param operatorId - Operator's primary key ID
 * @returns Number of leagues operator manages
 * @throws Error if database query fails
 *
 * @example
 * const count = await getLeagueCount('operator-uuid');
 * console.log(`Managing ${count} leagues`);
 */
export async function getLeagueCount(operatorId: string): Promise<number> {
  const { count, error } = await supabase
    .from('leagues')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', operatorId);

  if (error) {
    throw new Error(`Failed to fetch league count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Fetch league by ID
 *
 * Gets complete league record by primary key.
 *
 * @param leagueId - League's primary key ID
 * @returns Complete league record
 * @throws Error if league not found or database error
 *
 * @example
 * const league = await getLeagueById('league-uuid');
 */
export async function getLeagueById(leagueId: string): Promise<League> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch league: ${error.message}`);
  }

  return data;
}

/**
 * Calculate progress data for a single league
 *
 * Fetches all related data needed to determine league setup/season progress:
 * - Season count and most recent season
 * - Team count
 * - Player count
 * - Schedule existence
 * - Week completion for active season
 *
 * This is a complex query that makes multiple database calls.
 * Used by ActiveLeagues component to show progress bars.
 *
 * @param league - Base league object to calculate progress for
 * @returns League with embedded _progress data
 * @throws Error if any database query fails
 *
 * @example
 * const league = await getLeagueById('league-uuid');
 * const withProgress = await calculateLeagueProgress(league);
 * console.log(`${withProgress._progress.completedWeeks}/${withProgress._progress.totalWeeks} weeks done`);
 */
export async function calculateLeagueProgress(league: League): Promise<LeagueWithProgress> {
  // Fetch season count
  const { count: seasonCount } = await supabase
    .from('seasons')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', league.id);

  // Fetch most recent season (regardless of status - could be upcoming, active, or completed)
  const { data: activeSeasonData } = await supabase
    .from('seasons')
    .select('*')
    .eq('league_id', league.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let completedWeeks = 0;
  let totalWeeks = 0;
  if (activeSeasonData) {
    // Get week counts for most recent season
    const { count: total } = await supabase
      .from('season_weeks')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', activeSeasonData.id)
      .eq('week_type', 'regular');

    const { count: completed } = await supabase
      .from('season_weeks')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', activeSeasonData.id)
      .eq('week_type', 'regular')
      .eq('week_completed', true);

    totalWeeks = total || 0;
    completedWeeks = completed || 0;
  }

  // Fetch team count — active-only (bye / withdrawn / forfeited rows
  // are not user-visible teams).
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', league.id)
    .eq('status', 'active');

  // Fetch player count (across all teams in league)
  const { count: playerCount } = await supabase
    .from('team_players')
    .select('teams!inner(league_id)', { count: 'exact', head: true })
    .eq('teams.league_id', league.id);

  // Check if schedule exists (any matches in any season)
  const { data: seasonData } = await supabase
    .from('seasons')
    .select('id')
    .eq('league_id', league.id);

  let scheduleExists = false;
  if (seasonData && seasonData.length > 0) {
    const seasonIds = seasonData.map((s) => s.id);
    const { count: matchesCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .in('season_id', seasonIds);
    scheduleExists = (matchesCount || 0) > 0;
  }

  // Cheap existence check for a queued (scheduled) season — the
  // "Create Next Season" CTA hides when one already exists.
  const { count: scheduledCount } = await supabase
    .from('seasons')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', league.id)
    .eq('status', 'scheduled');

  return {
    ...league,
    _progress: {
      seasonCount: seasonCount || 0,
      teamCount: teamCount || 0,
      playerCount: playerCount || 0,
      scheduleExists,
      activeSeason: activeSeasonData,
      completedWeeks,
      totalWeeks,
      hasScheduledSeason: (scheduledCount ?? 0) > 0,
    },
  };
}

/**
 * Fetch all leagues for an operator with progress data
 *
 * Combines getLeaguesByOperator with calculateLeagueProgress.
 * This is an expensive query that fetches all related data for each league.
 * Use sparingly - prefer useLeaguesByOperator for simple lists.
 *
 * @param operatorId - Operator's primary key ID
 * @returns Array of leagues with embedded progress data
 * @throws Error if database query fails
 *
 * @example
 * const leagues = await getLeaguesWithProgress('operator-uuid');
 * leagues.forEach(league => {
 *   const progress = (league._progress.completedWeeks / league._progress.totalWeeks) * 100;
 *   console.log(`${league.game_type}: ${progress}% complete`);
 * });
 */
export async function getLeaguesWithProgress(operatorId: string): Promise<LeagueWithProgress[]> {
  // First fetch basic league data
  const leagues = await getLeaguesByOperator(operatorId);

  // Then calculate progress for each league in parallel
  const leaguesWithProgress = await Promise.all(
    leagues.map((league) => calculateLeagueProgress(league))
  );

  return leaguesWithProgress;
}

/**
 * Fetch league by season ID
 *
 * Gets the league that a season belongs to.
 * Used when you have a seasonId and need league configuration (game_type, team_format, etc).
 *
 * @param seasonId - Season's primary key ID
 * @returns Complete league record
 * @throws Error if season or league not found or database error
 *
 * @example
 * const league = await getLeagueBySeasonId('season-uuid');
 * console.log(`Game type: ${league.game_type}, Format: ${league.team_format}`);
 */
export async function getLeagueBySeasonId(seasonId: string): Promise<League> {
  // First get the season to find league_id
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('league_id')
    .eq('id', seasonId)
    .single();

  if (seasonError) {
    throw new Error(`Failed to fetch season: ${seasonError.message}`);
  }

  if (!season) {
    throw new Error('Season not found');
  }

  // Then fetch the league
  return getLeagueById(season.league_id);
}

/**
 * Fetch resolved profanity filter setting for a league
 *
 * Queries the resolved_league_preferences view which handles cascading:
 * league → organization → system default (false)
 * Returns whether profanity validation should be enforced for team names.
 * Used by TeamEditorModal to validate team name input.
 *
 * @param leagueId - League's primary key ID
 * @returns Boolean indicating if profanity filter is enabled
 * @throws Error if league not found
 *
 * @example
 * const shouldValidate = await getOperatorProfanityFilter('league-uuid');
 * if (shouldValidate && containsProfanity(teamName)) {
 *   throw new Error('Team name contains inappropriate language');
 * }
 */
export async function getOperatorProfanityFilter(leagueId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('resolved_league_preferences')
    .select('profanity_filter_enabled')
    .eq('league_id', leagueId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch resolved preferences: ${error?.message || 'League not found'}`);
  }

  return data.profanity_filter_enabled ?? false;
}
