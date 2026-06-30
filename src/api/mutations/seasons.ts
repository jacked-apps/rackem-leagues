/**
 * @fileoverview Season Mutation Functions
 *
 * Pure functions for season create/update/delete/activate operations.
 * These functions are wrapped by TanStack Query mutation hooks.
 *
 * Seasons represent a period of league play with:
 * - Start/end dates
 * - Season weeks (regular, playoffs, blackouts, breaks)
 * - Championship preferences (BCA/APA)
 * - Status (upcoming, active, completed, cancelled)
 *
 * @see api/hooks/useSeasonMutations.ts - Mutation hooks that wrap these functions
 */

import { supabase } from '@/supabaseClient';
import type { Season, SeasonInsertData, WeekEntry } from '@/types/season';
import { generateSeasonName, calculateEndDate, formatDateForDB } from '@/types/season';
import { formatDayOfWeek, formatGameType, type League } from '@/types/league';
import { parseLocalDate } from '@/utils/formatters';
import { submitChampionshipDates } from '@/utils/tournamentUtils';
import { logger } from '@/utils/logger';

/**
 * Parameters for creating a new season
 */
export interface CreateSeasonParams {
  leagueId: string;
  league: League;
  startDate: string; // ISO date string
  seasonLength: number;
  schedule: WeekEntry[];
  operatorId: string | null;
  // Championship preferences
  bcaChoice: string;
  bcaStartDate?: string;
  bcaEndDate?: string;
  bcaIgnored?: boolean;
  apaChoice: string;
  apaStartDate?: string;
  apaEndDate?: string;
  apaIgnored?: boolean;
  // Callback to save championship preference
  onSavePreference: (organization: 'BCA' | 'APA', choice: string, championshipId?: string) => Promise<void>;
}

/**
 * Parameters for updating an existing season
 */
export interface UpdateSeasonParams {
  seasonId: string;
  seasonName?: string;
  startDate?: string;
  endDate?: string;
  seasonLength?: number;
  status?: 'upcoming' | 'scheduled' | 'active' | 'completed' | 'cancelled';
}

/**
 * Parameters for activating a season
 */
export interface ActivateSeasonParams {
  seasonId: string;
  leagueId: string;
}

/**
 * Parameters for deleting a season
 */
export interface DeleteSeasonParams {
  seasonId: string;
}

/**
 * Create a new season with schedule weeks
 *
 * This creates:
 * 1. Season record
 * 2. All season_weeks records (regular, playoffs, blackouts, breaks)
 * 3. Championship date records (if custom dates entered)
 * 4. Championship preferences
 *
 * If weeks insertion fails, the season is automatically rolled back.
 *
 * @param params - Season creation parameters
 * @returns The newly created season
 * @throws Error if validation fails or database operation fails
 */
export async function createSeason(params: CreateSeasonParams): Promise<Season> {
  // Submit BCA championship dates if custom
  let bcaSavedId: string | undefined;
  if (params.bcaChoice === 'custom' && params.bcaStartDate && params.bcaEndDate) {
    const bcaResult = await submitChampionshipDates('BCA', params.bcaStartDate, params.bcaEndDate);
    if (bcaResult) {
      bcaSavedId = bcaResult.id;
    } else {
      logger.error('Failed to save BCA championship dates');
    }
  }

  // Save BCA preference
  await params.onSavePreference(
    'BCA',
    params.bcaChoice,
    bcaSavedId || (params.bcaChoice !== 'custom' && params.bcaChoice !== 'ignore' ? params.bcaChoice : undefined)
  );

  // Submit APA championship dates if custom
  let apaSavedId: string | undefined;
  if (params.apaChoice === 'custom' && params.apaStartDate && params.apaEndDate) {
    const apaResult = await submitChampionshipDates('APA', params.apaStartDate, params.apaEndDate);
    if (apaResult) {
      apaSavedId = apaResult.id;
    } else {
      logger.error('Failed to save APA championship dates');
    }
  }

  // Save APA preference
  await params.onSavePreference(
    'APA',
    params.apaChoice,
    apaSavedId || (params.apaChoice !== 'custom' && params.apaChoice !== 'ignore' ? params.apaChoice : undefined)
  );

  // Calculate end date
  const startDate = parseLocalDate(params.startDate);
  const endDate = calculateEndDate(startDate, params.seasonLength);

  // Generate season name
  const seasonName = generateSeasonName(
    startDate,
    formatDayOfWeek(params.league.day_of_week),
    formatGameType(params.league.game_type),
    params.league.division
  );

  // Build insert data
  const insertData: SeasonInsertData = {
    league_id: params.leagueId,
    season_name: seasonName,
    start_date: formatDateForDB(startDate),
    end_date: formatDateForDB(endDate),
    season_length: params.seasonLength,
    status: 'upcoming',
  };

  let createdSeasonId: string | null = null;

  try {
    // Step 1: Insert season record
    const { data: newSeason, error: seasonError } = await supabase
      .from('seasons')
      .insert([insertData])
      .select()
      .single();

    if (seasonError) {
      throw new Error(`Failed to create season: ${seasonError.message}`);
    }

    createdSeasonId = newSeason.id;

    // Step 2: Prepare week records. Off weeks (holidays + season-end break) are
    // all `blackout`; their human label lives in `notes`. Regular/playoff labels
    // are DERIVED from position (deriveWeekLabels), never stored. week_name is a
    // transitional NOT-NULL value, dropped in Phase C.
    const allWeeks = params.schedule.map(week => {
      let weekType: 'regular' | 'playoffs' | 'blackout';

      if (week.type === 'week-off') {
        weekType = 'blackout';
      } else if (week.type === 'playoffs') {
        weekType = 'playoffs';
      } else {
        weekType = 'regular';
      }

      return {
        season_id: createdSeasonId,
        scheduled_date: week.date,
        week_name: week.weekName,
        week_type: weekType,
        week_completed: false,
        notes: weekType === 'blackout' ? week.weekName : null,
      };
    });

    // Step 3: Batch insert all weeks
    const { error: weeksError } = await supabase
      .from('season_weeks')
      .insert(allWeeks);

    if (weeksError) {
      throw new Error(`Failed to insert season weeks: ${weeksError.message}`);
    }

    return newSeason;
  } catch (error) {
    // Rollback: Delete the season if weeks insertion failed
    if (createdSeasonId) {
      await supabase.from('seasons').delete().eq('id', createdSeasonId);
    }
    throw error;
  }
}

/**
 * Update an existing season
 *
 * Updates season metadata (name, dates, length, status).
 * Does NOT update season_weeks - use separate schedule editing flow for that.
 *
 * @param params - Season update parameters
 * @returns The updated season
 * @throws Error if database operation fails
 */
export async function updateSeason(params: UpdateSeasonParams): Promise<Season> {
  const updateData: Partial<Season> = {};

  if (params.seasonName !== undefined) updateData.season_name = params.seasonName;
  if (params.startDate !== undefined) updateData.start_date = params.startDate;
  if (params.endDate !== undefined) updateData.end_date = params.endDate;
  if (params.seasonLength !== undefined) updateData.season_length = params.seasonLength;
  if (params.status !== undefined) updateData.status = params.status;

  const { data: updatedSeason, error } = await supabase
    .from('seasons')
    .update(updateData)
    .eq('id', params.seasonId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update season: ${error.message}`);
  }

  return updatedSeason;
}

/**
 * Activate a season
 *
 * Sets the season status to 'active' and deactivates any other active seasons
 * for the same league (only one active season per league).
 *
 * @param params - Activation parameters
 * @returns The activated season
 * @throws Error if database operation fails
 */
export async function activateSeason(params: ActivateSeasonParams): Promise<Season> {
  // Step 1: Deactivate any currently active seasons for this league
  const { error: deactivateError } = await supabase
    .from('seasons')
    .update({ status: 'completed' })
    .eq('league_id', params.leagueId)
    .eq('status', 'active');

  if (deactivateError) {
    throw new Error(`Failed to deactivate existing seasons: ${deactivateError.message}`);
  }

  // Step 2: Activate the specified season
  const { data: activatedSeason, error: activateError } = await supabase
    .from('seasons')
    .update({ status: 'active' })
    .eq('id', params.seasonId)
    .select()
    .single();

  if (activateError) {
    throw new Error(`Failed to activate season: ${activateError.message}`);
  }

  return activatedSeason;
}

/**
 * Delete a season (soft delete by setting status to 'cancelled')
 *
 * This does NOT delete season_weeks records - they remain for historical data.
 * Only the season status is changed to 'cancelled'.
 *
 * @param params - Season deletion parameters
 * @returns The cancelled season
 * @throws Error if database operation fails
 */
export async function deleteSeason(params: DeleteSeasonParams): Promise<Season> {
  const { data: cancelledSeason, error } = await supabase
    .from('seasons')
    .update({ status: 'cancelled' })
    .eq('id', params.seasonId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel season: ${error.message}`);
  }

  return cancelledSeason;
}
