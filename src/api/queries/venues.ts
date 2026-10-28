/**
 * @fileoverview Venue Query Functions
 *
 * Pure data fetching functions for venue-related queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 *
 * @see api/hooks/useVenues.ts - React hook wrapper
 */

import { supabase } from '@/supabaseClient';
import type { Venue, LeagueVenue } from '@/types/venue';

/**
 * Fetch all active venues for an organization
 *
 * Gets venues created by the organization that are currently active.
 * Ordered alphabetically by name.
 *
 * @param organizationId - Organization's primary key ID
 * @returns Array of active venues
 * @throws Error if database query fails
 *
 * @example
 * const venues = await getVenuesByOrganization('org-uuid');
 * venues.forEach(venue => console.log(venue.name, venue.city));
 */
export async function getVenuesByOrganization(organizationId: string): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch venues: ${error.message}`);
  }

  // Generated types mark the table-count columns nullable; the app type
  // treats them as always set (they default to 0 / []), as it did before.
  return (data || []) as Venue[];
}

/**
 * @deprecated Use getVenuesByOrganization instead
 * Fetch all active venues for an operator
 */
export async function getVenuesByOperator(operatorId: string): Promise<Venue[]> {
  return getVenuesByOrganization(operatorId);
}

/**
 * Fetch venue by ID
 *
 * Gets complete venue record by primary key.
 *
 * @param venueId - Venue's primary key ID
 * @returns Complete venue record
 * @throws Error if venue not found or database error
 *
 * @example
 * const venue = await getVenueById('venue-uuid');
 * console.log(`${venue.name} - ${venue.city}, ${venue.state}`);
 */
export async function getVenueById(venueId: string): Promise<Venue> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', venueId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch venue: ${error.message}`);
  }

  // Generated types mark the table-count columns nullable; the app type
  // treats them as always set (they default to 0 / []), as it did before.
  return data as Venue;
}

/**
 * Fetch league venue assignments for a league
 *
 * Gets all venue assignments (with table limits) for a specific league.
 *
 * @param leagueId - League's primary key ID
 * @returns Array of league venue assignments
 * @throws Error if database query fails
 *
 * @example
 * const leagueVenues = await getLeagueVenues('league-uuid');
 * leagueVenues.forEach(lv => {
 *   console.log(`Venue ${lv.venue_id}: ${lv.available_regulation_tables} tables`);
 * });
 */
export async function getLeagueVenues(leagueId: string): Promise<LeagueVenue[]> {
  const { data, error } = await supabase
    .from('league_venues')
    .select('*')
    .eq('league_id', leagueId);

  if (error) {
    throw new Error(`Failed to fetch league venues: ${error.message}`);
  }

  // Generated types mark the table-count columns nullable; the app type
  // treats them as always set (they default to 0 / []), as it did before.
  return (data || []) as LeagueVenue[];
}

/**
 * Fetch league venues with full venue details
 *
 * Gets league venue assignments with expanded venue information.
 * Useful for displaying venue lists with names and addresses.
 *
 * @param leagueId - League's primary key ID
 * @returns Array of league venues with nested venue data
 * @throws Error if database query fails
 *
 * @example
 * const leagueVenues = await getLeagueVenuesWithDetails('league-uuid');
 * leagueVenues.forEach(lv => {
 *   console.log(`${lv.venue.name}: ${lv.available_regulation_tables} tables available`);
 * });
 */
export async function getLeagueVenuesWithDetails(leagueId: string): Promise<Array<LeagueVenue & { venue: Venue }>> {
  const { data, error } = await supabase
    .from('league_venues')
    .select(`
      *,
      venue:venues(*)
    `)
    .eq('league_id', leagueId);

  if (error) {
    throw new Error(`Failed to fetch league venues with details: ${error.message}`);
  }

  return data as any || [];
}
