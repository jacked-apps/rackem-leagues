/**
 * @fileoverview Season Query Functions
 *
 * Pure data fetching functions for season-related queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 *
 * @see api/hooks/useSeasons.ts - React hook wrapper
 */

import { supabase } from '@/supabaseClient';
import type { ChampionshipPreference } from '@/data/seasonWizardSteps';

// Use the canonical Season type from types/season.ts
import type { Season } from '@/types/season';
export type { Season };

/**
 * Fetch all seasons for a league
 *
 * Gets all seasons ordered by creation date (newest first).
 * Used for season history and selection dropdowns.
 *
 * @param leagueId - League's primary key ID
 * @returns Array of seasons ordered by creation date (newest first)
 * @throws Error if database query fails
 *
 * @example
 * const seasons = await getSeasonsByLeague('league-uuid');
 * seasons.forEach(season => console.log(`Season ${season.season_number}: ${season.status}`));
 */
export async function getSeasonsByLeague(leagueId: string): Promise<Season[]> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch seasons: ${error.message}`);
  }

  // `status` is plain text in the DB; seasons_status_check keeps it to SeasonStatus.
  return (data || []) as Season[];
}

/**
 * Fetch season by ID
 *
 * Gets complete season record by primary key.
 *
 * @param seasonId - Season's primary key ID
 * @returns Complete season record
 * @throws Error if season not found or database error
 *
 * @example
 * const season = await getSeasonById('season-uuid');
 * console.log(`Season ${season.season_number} runs from ${season.start_date} to ${season.end_date}`);
 */
export async function getSeasonById(seasonId: string): Promise<Season> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', seasonId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch season: ${error.message}`);
  }

  // `status` is plain text in the DB; seasons_status_check keeps it to SeasonStatus.
  return data as Season;
}

/**
 * Fetch most recent season for a league
 *
 * Gets the latest season (by creation date) regardless of status.
 * Could be upcoming, active, or completed.
 * Returns null if league has no seasons yet.
 *
 * @param leagueId - League's primary key ID
 * @returns Most recent season or null if none exist
 * @throws Error if database query fails
 *
 * @example
 * const currentSeason = await getMostRecentSeason('league-uuid');
 * if (currentSeason) {
 *   console.log(`Current season status: ${currentSeason.status}`);
 * }
 */
export async function getMostRecentSeason(leagueId: string): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch most recent season: ${error.message}`);
  }

  // `status` is plain text in the DB; seasons_status_check keeps it to SeasonStatus.
  return data as Season | null;
}

/**
 * Fetch active season for a league
 *
 * Gets the season with status='active' for a league.
 * Returns null if no active season exists.
 *
 * @param leagueId - League's primary key ID
 * @returns Active season or null if none exists
 * @throws Error if database query fails
 *
 * @example
 * const activeSeason = await getActiveSeason('league-uuid');
 * if (activeSeason) {
 *   console.log(`Active season ${activeSeason.season_number} is in progress`);
 * } else {
 *   console.log('No active season - league is between seasons');
 * }
 */
export async function getActiveSeason(leagueId: string): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('league_id', leagueId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch active season: ${error.message}`);
  }

  // `status` is plain text in the DB; seasons_status_check keeps it to SeasonStatus.
  return data as Season | null;
}

/**
 * Fetch count of seasons for a league
 *
 * Efficient count-only query for league progress calculations.
 * Doesn't fetch full season data.
 *
 * @param leagueId - League's primary key ID
 * @returns Number of seasons in league
 * @throws Error if database query fails
 *
 * @example
 * const count = await getSeasonCount('league-uuid');
 * console.log(`This league has run ${count} seasons`);
 */
export async function getSeasonCount(leagueId: string): Promise<number> {
  const { count, error } = await supabase
    .from('seasons')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId);

  if (error) {
    throw new Error(`Failed to fetch season count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Get the most recent completed season before a given date
 *
 * Finds the previous season that was completed before the current/active season started.
 * Useful for importing teams from previous seasons.
 *
 * @param leagueId - League ID
 * @param beforeDate - ISO date string to search before (typically current season's created_at)
 * @returns Previous completed season or null if none found
 */
export async function getPreviousCompletedSeason(
  leagueId: string,
  beforeDate: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('league_id', leagueId)
    .eq('status', 'completed')
    .lt('created_at', beforeDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch previous completed season: ${error.message}`);
  }

  return data;
}

/**
 * Fetch operator's saved championship preferences from database
 *
 * Gets championship date preferences (BCA/APA) that the operator has saved
 * for consideration during season scheduling.
 *
 * @param operatorId - The operator's ID to fetch preferences for
 * @returns Array of saved championship preferences or empty array if none exist
 * @throws Error if database query fails
 *
 * @example
 * const preferences = await getChampionshipPreferences('operator-123');
 * preferences.forEach(pref => {
 *   console.log(`${pref.organization}: ${pref.startDate} - ${pref.endDate}`);
 * });
 */
export async function getChampionshipPreferences(
  operatorId: string
): Promise<ChampionshipPreference[]> {
  const { data: preferences, error } = await supabase
    .from('operator_blackout_preferences')
    .select('*, championship_date_options(*)')
    .eq('organization_id', operatorId)
    .eq('preference_type', 'championship');

  if (error) {
    throw new Error(`Failed to fetch championship preferences: ${error.message}`);
  }

  if (!preferences || preferences.length === 0) {
    return [];
  }

  const prefs: ChampionshipPreference[] = preferences
    .filter(p => p.championship_date_options && p.preference_action !== null)
    .map(p => ({
      organization: p.championship_date_options!.organization as 'BCA' | 'APA',
      startDate: p.championship_date_options!.start_date,
      endDate: p.championship_date_options!.end_date,
      ignored: p.preference_action === 'ignore',
    }));

  return prefs;
}
