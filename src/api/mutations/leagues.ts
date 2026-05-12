/**
 * @fileoverview League Mutation Functions
 *
 * Write operations for leagues (create, update, delete).
 * These functions are used by TanStack Query useMutation hooks.
 *
 * @see api/hooks/useLeagueMutations.ts - React hooks wrapper
 */

import { supabase } from '@/supabaseClient';
import type { League, LeagueInsertData, DayOfWeek, GameType, HandicapVariant } from '@/types/league';
import type { SystemOverrides } from '@/types/systemOverrides';

/**
 * Parameters for creating a new league
 */
export interface CreateLeagueParams {
  operatorId: string;
  gameType: GameType;
  dayOfWeek: DayOfWeek;
  handicapVariant: HandicapVariant;
  teamHandicapVariant: HandicapVariant;
  leagueStartDate: string; // ISO date string
  division?: string | null;
}

/**
 * Parameters for updating a league
 */
export interface UpdateLeagueParams {
  leagueId: string;
  gameType?: GameType;
  dayOfWeek?: DayOfWeek;
  leagueStartDate?: string;
  division?: string | null;
  status?: 'active' | 'completed' | 'abandoned';
}

/**
 * Parameters for deleting a league
 */
export interface DeleteLeagueParams {
  leagueId: string;
}

/**
 * Update Parameters for league day of week
 */
export interface UpdateLeagueDayParams {
  leagueId: string;
  newDay: string;
}

/**
 * Create a new league
 *
 * @param params - League creation parameters
 * @returns The newly created league
 * @throws Error if validation fails or database operation fails
 */
export async function createLeague(params: CreateLeagueParams): Promise<League> {
  const insertData: LeagueInsertData = {
    organization_id: params.operatorId,
    game_type: params.gameType,
    day_of_week: params.dayOfWeek,
    handicap_variant: params.handicapVariant,
    team_handicap_variant: params.teamHandicapVariant,
    league_start_date: params.leagueStartDate,
    division: params.division || null,
    // golden_break_counts_as_win removed 2026-05-12 — Golden Break is now
    // configured via enabled_events.golden_break on the preferences
    // cascade (registry default = false for 8-ball / BCA Standard).
  };

  const { data: newLeague, error } = await supabase
    .from('leagues')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create league: ${error.message}`);
  }

  return newLeague;
}

/**
 * Update an existing league
 *
 * @param params - League update parameters
 * @returns The updated league
 * @throws Error if database operation fails
 */
export async function updateLeague(params: UpdateLeagueParams): Promise<League> {
  const updateData: Partial<League> = {};

  if (params.gameType !== undefined) updateData.game_type = params.gameType;
  if (params.dayOfWeek !== undefined) updateData.day_of_week = params.dayOfWeek;
  if (params.leagueStartDate !== undefined) updateData.league_start_date = params.leagueStartDate;
  if (params.division !== undefined) updateData.division = params.division;
  if (params.status !== undefined) updateData.status = params.status;

  const { data: updatedLeague, error } = await supabase
    .from('leagues')
    .update(updateData)
    .eq('id', params.leagueId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update league: ${error.message}`);
  }

  return updatedLeague;
}

/**
 * Delete a league (hard delete with cascade)
 *
 * This will cascade delete:
 * - All seasons for this league
 * - All teams in those seasons
 * - All matches in those seasons
 * - All season weeks
 * - League-venue relationships
 *
 * WARNING: This is a destructive operation. Consider soft delete (status='abandoned') instead.
 *
 * @param params - League deletion parameters
 * @returns void
 * @throws Error if database operation fails
 */
export async function deleteLeague(params: DeleteLeagueParams): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .delete()
    .eq('id', params.leagueId);

  if (error) {
    throw new Error(`Failed to delete league: ${error.message}`);
  }
}

/**
 * Updates the day of week for a league in the database
 *
 * Used when operator changes the league schedule day.
 * Converts day name to numeric format (0-6) for database storage.
 *
 * @param params - League ID and new day name
 * @returns The updated day of week as lowercase string
 * @throws Error if database update fails
 *
 * @example
 * const result = await updateLeagueDayOfWeek({
 *   leagueId: 'league-123',
 *   newDay: 'Wednesday'
 * });
 * console.log(result); // 'wednesday'
 */
export async function updateLeagueDayOfWeek(
  params: UpdateLeagueDayParams
): Promise<DayOfWeek> {
  const { leagueId, newDay } = params;

  // Convert day name to number (0 = Sunday, 6 = Saturday)
  const dayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const newDayNumber = dayMap[newDay];
  const newDayString = newDay.toLowerCase() as DayOfWeek;

  // Update the league's day_of_week in database
  const { error } = await supabase
    .from('leagues')
    .update({ day_of_week: newDayNumber })
    .eq('id', leagueId);

  if (error) {
    throw new Error(`Failed to update league day of week: ${error.message}`);
  }

  return newDayString;
}

// ============================================================================
// TIER 2 MUTABILITY — season-active lock for per-league dial overrides
// ============================================================================

/**
 * Check whether a league has an active season — defined as at least one match
 * in `in_progress` or `completed` status. Used by tier-2 guards to block
 * scoring-dial edits after play has started for the season.
 *
 * This is a read-only check; safe to call from any context.
 */
export async function isLeagueSeasonActive(leagueId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('season.league_id', leagueId)
    .in('status', ['in_progress', 'completed'])
    .limit(1);

  // If the nested filter path isn't supported by the server, the above may fail;
  // fall back to joining through seasons explicitly.
  if (error) {
    const { data: seasons } = await supabase
      .from('seasons')
      .select('id')
      .eq('league_id', leagueId);

    if (!seasons || seasons.length === 0) return false;

    const seasonIds = seasons.map((s) => s.id);
    const { count } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .in('season_id', seasonIds)
      .in('status', ['in_progress', 'completed']);

    return (count ?? 0) > 0;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Update a league's `system_overrides` JSONB — tier 2 mutability.
 *
 * Throws a user-facing error if the season is currently active. Editable
 * between seasons; once the first match transitions to in_progress, this
 * blocks further edits to protect active scoring from retroactive dial shifts.
 *
 * Tier 3 (match-start snapshot) provides additional belt-and-braces: even if
 * a caller bypasses this guard, in-flight matches score from their snapshot
 * and aren't affected by subsequent dial edits.
 */
export async function updateLeagueSystemOverrides(params: {
  leagueId: string;
  overrides: SystemOverrides;
}): Promise<void> {
  const active = await isLeagueSeasonActive(params.leagueId);
  if (active) {
    throw new Error(
      'These settings are locked while the season is active. They will become editable once the season ends.',
    );
  }

  const { error } = await supabase
    .from('leagues')
    .update({ system_overrides: params.overrides })
    .eq('id', params.leagueId);

  if (error) {
    throw new Error(`Failed to update league system overrides: ${error.message}`);
  }
}
