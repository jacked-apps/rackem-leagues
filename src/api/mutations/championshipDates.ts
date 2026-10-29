/**
 * @fileoverview Championship Date Options Mutations
 *
 * Functions for creating, updating, and deleting championship date options.
 * These dates represent BCA and APA national championship dates that operators
 * can use to avoid scheduling conflicts.
 *
 * Related tables:
 * - championship_date_options: Stores championship dates with community voting
 * - operator_blackout_preferences: References championship dates for auto-blackout
 */

import { supabase } from '@/supabaseClient';
import type { ChampionshipDateOption } from '@/utils/tournamentUtils';

/**
 * Parameters for creating a championship date option
 */
export interface CreateChampionshipDateParams {
  organization: 'BCA' | 'APA';
  year: number;
  start_date: string; // ISO date format YYYY-MM-DD
  end_date: string;   // ISO date format YYYY-MM-DD
  vote_count?: number;
  dev_verified?: boolean;
}

/**
 * Parameters for updating a championship date option
 */
export interface UpdateChampionshipDateParams {
  championshipDateId: string;
  organization?: 'BCA' | 'APA';
  year?: number;
  start_date?: string;
  end_date?: string;
  vote_count?: number;
  dev_verified?: boolean;
}

/**
 * Parameters for deleting a championship date option
 */
export interface DeleteChampionshipDateParams {
  championshipDateId: string;
}

/**
 * Create a new championship date option
 *
 * Validates date range and organization. Creates a new entry in the
 * championship_date_options table with vote_count defaulting to 1.
 *
 * @param params - Championship date creation parameters
 * @returns Created championship date option
 * @throws Error if validation fails or database operation fails
 *
 * @example
 * const championship = await createChampionshipDate({
 *   organization: 'BCA',
 *   year: 2025,
 *   start_date: '2025-07-15',
 *   end_date: '2025-07-20'
 * });
 */
export async function createChampionshipDate(
  params: CreateChampionshipDateParams
): Promise<ChampionshipDateOption> {
  // Validation
  if (!params.organization || !['BCA', 'APA'].includes(params.organization)) {
    throw new Error('Organization must be BCA or APA');
  }

  if (!params.year || params.year < 2024 || params.year > 2050) {
    throw new Error('Year must be between 2024 and 2050');
  }

  if (!params.start_date || !params.end_date) {
    throw new Error('Start date and end date are required');
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(params.start_date) || !dateRegex.test(params.end_date)) {
    throw new Error('Dates must be in YYYY-MM-DD format');
  }

  // Validate end_date is after start_date
  if (new Date(params.end_date) <= new Date(params.start_date)) {
    throw new Error('End date must be after start date');
  }

  const { data, error } = await supabase
    .from('championship_date_options')
    .insert([
      {
        organization: params.organization,
        year: params.year,
        start_date: params.start_date,
        end_date: params.end_date,
        vote_count: params.vote_count ?? 1,
        dev_verified: params.dev_verified ?? false,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to create championship date: ${error.message} (${error.code})`
    );
  }

  // `organization` is plain text in the generated types; a CHECK constraint
  // limits it to 'BCA' | 'APA'.
  return data as ChampionshipDateOption;
}

/**
 * Update an existing championship date option
 *
 * Allows updating organization, year, dates, vote_count, and dev_verified status.
 * Only provided fields will be updated.
 *
 * @param params - Championship date update parameters
 * @returns Updated championship date option
 * @throws Error if validation fails or database operation fails
 *
 * @example
 * const updated = await updateChampionshipDate({
 *   championshipDateId: 'abc-123',
 *   vote_count: 5,
 *   dev_verified: true
 * });
 */
export async function updateChampionshipDate(
  params: UpdateChampionshipDateParams
): Promise<ChampionshipDateOption> {
  if (!params.championshipDateId) {
    throw new Error('Championship date ID is required');
  }

  // Build update object with only provided fields
  const updates: Record<string, any> = {};

  if (params.organization !== undefined) {
    if (!['BCA', 'APA'].includes(params.organization)) {
      throw new Error('Organization must be BCA or APA');
    }
    updates.organization = params.organization;
  }

  if (params.year !== undefined) {
    if (params.year < 2024 || params.year > 2050) {
      throw new Error('Year must be between 2024 and 2050');
    }
    updates.year = params.year;
  }

  if (params.start_date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.start_date)) {
      throw new Error('Start date must be in YYYY-MM-DD format');
    }
    updates.start_date = params.start_date;
  }

  if (params.end_date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.end_date)) {
      throw new Error('End date must be in YYYY-MM-DD format');
    }
    updates.end_date = params.end_date;
  }

  if (params.vote_count !== undefined) {
    if (params.vote_count < 1) {
      throw new Error('Vote count must be at least 1');
    }
    updates.vote_count = params.vote_count;
  }

  if (params.dev_verified !== undefined) {
    updates.dev_verified = params.dev_verified;
  }

  const { data, error } = await supabase
    .from('championship_date_options')
    .update(updates)
    .eq('id', params.championshipDateId)
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to update championship date: ${error.message} (${error.code})`
    );
  }

  // `organization` is plain text in the generated types; a CHECK constraint
  // limits it to 'BCA' | 'APA'.
  return data as ChampionshipDateOption;
}

/**
 * Delete a championship date option
 *
 * WARNING: This will also set championship_id to NULL in any
 * operator_blackout_preferences that reference this championship
 * (due to ON DELETE SET NULL constraint).
 *
 * @param params - Championship date deletion parameters
 * @throws Error if database operation fails
 *
 * @example
 * await deleteChampionshipDate({ championshipDateId: 'abc-123' });
 */
export async function deleteChampionshipDate(
  params: DeleteChampionshipDateParams
): Promise<void> {
  if (!params.championshipDateId) {
    throw new Error('Championship date ID is required');
  }

  const { error } = await supabase
    .from('championship_date_options')
    .delete()
    .eq('id', params.championshipDateId);

  if (error) {
    throw new Error(
      `Failed to delete championship date: ${error.message} (${error.code})`
    );
  }
}
