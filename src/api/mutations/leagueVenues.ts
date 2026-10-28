/**
 * @fileoverview League Venue Mutation Functions
 *
 * Pure functions for league-venue relationship operations.
 * These functions are wrapped by TanStack Query mutation hooks.
 *
 * League venues represent the many-to-many relationship between leagues and venues.
 * Each assignment tracks which specific table numbers from the venue are available
 * for that league, plus an optional capacity limit for max home teams.
 *
 * @see api/hooks/useLeagueVenueMutations.ts - Mutation hooks that wrap these functions
 */

import { supabase } from '@/supabaseClient';
import type { LeagueVenue, LeagueVenueInsertData } from '@/types/venue';

/**
 * Parameters for adding a venue to a league
 */
export interface AddLeagueVenueParams {
  leagueId: string;
  venueId: string;
  /** Array of table numbers available for this league */
  availableTableNumbers: number[];
  /** Max home teams (defaults to table count if not specified) */
  capacity?: number | null;
}

/**
 * Parameters for updating league-venue table limits
 */
export interface UpdateLeagueVenueParams {
  leagueVenueId: string;
  /** Array of table numbers available for this league */
  availableTableNumbers: number[];
  /** Max home teams (defaults to table count if not specified) */
  capacity?: number | null;
}

/**
 * Parameters for removing a venue from a league
 */
export interface RemoveLeagueVenueParams {
  leagueVenueId: string;
}

/**
 * Add a venue to a league
 *
 * Creates the league-venue relationship with specified table numbers and capacity.
 *
 * @param params - League venue creation parameters
 * @returns The newly created league-venue relationship
 * @throws Error if validation fails or database operation fails
 */
export async function addLeagueVenue(params: AddLeagueVenueParams): Promise<LeagueVenue> {
  // Validation
  if (params.availableTableNumbers.length === 0) {
    throw new Error('At least one table must be available');
  }

  const insertData: LeagueVenueInsertData = {
    league_id: params.leagueId,
    venue_id: params.venueId,
    available_table_numbers: params.availableTableNumbers,
    capacity: params.capacity ?? params.availableTableNumbers.length,
  };

  const { data: newLeagueVenue, error } = await supabase
    .from('league_venues')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add venue to league: ${error.message}`);
  }

  // available_table_numbers is nullable in the DB but always written here.
  return newLeagueVenue as LeagueVenue;
}

/**
 * Update league-venue table limits
 *
 * Updates which tables from this venue are available for the league.
 *
 * @param params - League venue update parameters
 * @returns The updated league-venue relationship
 * @throws Error if validation fails or database operation fails
 */
export async function updateLeagueVenue(params: UpdateLeagueVenueParams): Promise<LeagueVenue> {
  // Validation
  if (params.availableTableNumbers.length === 0) {
    throw new Error('At least one table must be available');
  }

  const { data: updatedLeagueVenue, error } = await supabase
    .from('league_venues')
    .update({
      available_table_numbers: params.availableTableNumbers,
      capacity: params.capacity ?? params.availableTableNumbers.length,
    })
    .eq('id', params.leagueVenueId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update league venue limits: ${error.message}`);
  }

  // available_table_numbers is nullable in the DB but always written here.
  return updatedLeagueVenue as LeagueVenue;
}

/**
 * Remove a venue from a league
 *
 * Deletes the league-venue relationship.
 *
 * @param params - League venue removal parameters
 * @returns void
 * @throws Error if database operation fails
 */
export async function removeLeagueVenue(params: RemoveLeagueVenueParams): Promise<void> {
  const { error } = await supabase
    .from('league_venues')
    .delete()
    .eq('id', params.leagueVenueId);

  if (error) {
    throw new Error(`Failed to remove venue from league: ${error.message}`);
  }
}
