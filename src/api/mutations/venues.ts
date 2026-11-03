/**
 * @fileoverview Venue Mutation Functions
 *
 * Pure mutation functions for venue operations.
 * These functions perform database writes and throw errors.
 * Used by TanStack Query mutation hooks.
 *
 * @see api/hooks/useVenueMutations.ts - React hook wrapper
 */

import { supabase } from '@/supabaseClient';
import type { Venue } from '@/types/venue';

/**
 * Parameters for creating a venue
 *
 * Note: Table counts are derived from the array lengths.
 * The arrays store both count AND specific table numbers.
 */
export interface CreateVenueParams {
  organizationId: string;
  name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  /** Array of table numbers for 7-foot (bar box) tables. Example: [1, 2, 3]. Length = count. */
  bar_box_table_numbers: number[];
  /** Array of table numbers for 8-foot tables. Example: [4, 5]. Length = count. */
  eight_foot_table_numbers: number[];
  /** Array of table numbers for 9-foot (regulation) tables. Example: [6, 7, 8]. Length = count. */
  regulation_table_numbers: number[];
  proprietor_name?: string | null;
  proprietor_phone?: string | null;
  league_contact_name?: string | null;
  league_contact_phone?: string | null;
  league_contact_email?: string | null;
  website?: string | null;
  business_hours?: string | null;
  notes?: string | null;
}

/**
 * Parameters for updating a venue
 *
 * Note: Table counts are derived from the array lengths.
 * The arrays store both count AND specific table numbers.
 */
export interface UpdateVenueParams {
  venueId: string;
  name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  /** Array of table numbers for 7-foot (bar box) tables. Example: [1, 2, 3]. Length = count. */
  bar_box_table_numbers: number[];
  /** Array of table numbers for 8-foot tables. Example: [4, 5]. Length = count. */
  eight_foot_table_numbers: number[];
  /** Array of table numbers for 9-foot (regulation) tables. Example: [6, 7, 8]. Length = count. */
  regulation_table_numbers: number[];
  proprietor_name?: string | null;
  proprietor_phone?: string | null;
  league_contact_name?: string | null;
  league_contact_phone?: string | null;
  league_contact_email?: string | null;
  website?: string | null;
  business_hours?: string | null;
  notes?: string | null;
}

/**
 * Parameters for deleting a venue
 */
export interface DeleteVenueParams {
  venueId: string;
}

/**
 * Create a new venue
 *
 * Inserts a new venue record with all provided details.
 * Validates that at least one table (bar-box or regulation) exists.
 *
 * @param params - Venue creation parameters
 * @returns Created venue record
 * @throws Error if validation fails or database error occurs
 *
 * @example
 * const venue = await createVenue({
 *   organizationId: 'org-123',
 *   name: 'The Pool Hall',
 *   street_address: '123 Main St',
 *   city: 'Austin',
 *   state: 'TX',
 *   zip_code: '78701',
 *   phone: '512-555-1234',
 *   bar_box_tables: 4,
 *   regulation_tables: 2
 * });
 */
export async function createVenue(params: CreateVenueParams): Promise<Venue> {
  // Validation
  if (!params.name.trim()) {
    throw new Error('Venue name is required');
  }
  if (!params.street_address.trim()) {
    throw new Error('Street address is required');
  }
  if (!params.city.trim()) {
    throw new Error('City is required');
  }
  if (!params.state.trim()) {
    throw new Error('State is required');
  }
  if (!params.zip_code.trim()) {
    throw new Error('Zip code is required');
  }
  if (!params.phone.trim()) {
    throw new Error('Phone number is required');
  }

  // Total tables = sum of all array lengths
  const totalTables =
    params.bar_box_table_numbers.length +
    params.eight_foot_table_numbers.length +
    params.regulation_table_numbers.length;

  if (totalTables === 0) {
    throw new Error('Venue must have at least one table');
  }

  // Insert only the array columns - count is derived from array length
  const insertData = {
    organization_id: params.organizationId,
    name: params.name.trim(),
    street_address: params.street_address.trim(),
    city: params.city.trim(),
    state: params.state.trim().toUpperCase(),
    zip_code: params.zip_code.trim(),
    phone: params.phone.trim(),
    bar_box_table_numbers: params.bar_box_table_numbers,
    eight_foot_table_numbers: params.eight_foot_table_numbers,
    regulation_table_numbers: params.regulation_table_numbers,
    proprietor_name: params.proprietor_name?.trim() || null,
    proprietor_phone: params.proprietor_phone?.trim() || null,
    league_contact_name: params.league_contact_name?.trim() || null,
    league_contact_phone: params.league_contact_phone?.trim() || null,
    league_contact_email: params.league_contact_email?.trim() || null,
    website: params.website?.trim() || null,
    business_hours: params.business_hours?.trim() || null,
    notes: params.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from('venues')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create venue: ${error.message}`);
  }

  // Legacy table-count columns are nullable in the DB; the app treats them as set.
  return data as Venue;
}

/**
 * Update an existing venue
 *
 * Updates venue details. All fields except venueId can be modified.
 * Validates that at least one table exists.
 *
 * @param params - Venue update parameters
 * @returns Updated venue record
 * @throws Error if validation fails or database error occurs
 *
 * @example
 * const venue = await updateVenue({
 *   venueId: 'venue-123',
 *   name: 'The New Pool Hall',
 *   street_address: '456 Oak St',
 *   city: 'Austin',
 *   state: 'TX',
 *   zip_code: '78702',
 *   phone: '512-555-5678',
 *   bar_box_tables: 6,
 *   regulation_tables: 3
 * });
 */
export async function updateVenue(params: UpdateVenueParams): Promise<Venue> {
  // Validation
  if (!params.name.trim()) {
    throw new Error('Venue name is required');
  }
  if (!params.street_address.trim()) {
    throw new Error('Street address is required');
  }
  if (!params.city.trim()) {
    throw new Error('City is required');
  }
  if (!params.state.trim()) {
    throw new Error('State is required');
  }
  if (!params.zip_code.trim()) {
    throw new Error('Zip code is required');
  }
  if (!params.phone.trim()) {
    throw new Error('Phone number is required');
  }

  // Total tables = sum of all array lengths
  const totalTables =
    params.bar_box_table_numbers.length +
    params.eight_foot_table_numbers.length +
    params.regulation_table_numbers.length;

  if (totalTables === 0) {
    throw new Error('Venue must have at least one table');
  }

  // Update only the array columns - count is derived from array length
  const updateData = {
    name: params.name.trim(),
    street_address: params.street_address.trim(),
    city: params.city.trim(),
    state: params.state.trim().toUpperCase(),
    zip_code: params.zip_code.trim(),
    phone: params.phone.trim(),
    bar_box_table_numbers: params.bar_box_table_numbers,
    eight_foot_table_numbers: params.eight_foot_table_numbers,
    regulation_table_numbers: params.regulation_table_numbers,
    proprietor_name: params.proprietor_name?.trim() || null,
    proprietor_phone: params.proprietor_phone?.trim() || null,
    league_contact_name: params.league_contact_name?.trim() || null,
    league_contact_phone: params.league_contact_phone?.trim() || null,
    league_contact_email: params.league_contact_email?.trim() || null,
    website: params.website?.trim() || null,
    business_hours: params.business_hours?.trim() || null,
    notes: params.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from('venues')
    .update(updateData)
    .eq('id', params.venueId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update venue: ${error.message}`);
  }

  // Legacy table-count columns are nullable in the DB; the app treats them as set.
  return data as Venue;
}

/**
 * Delete a venue (soft delete)
 *
 * Marks venue as inactive rather than physically deleting.
 * This preserves historical data and league assignments.
 *
 * @param params - Venue deletion parameters
 * @returns void
 * @throws Error if database error occurs
 *
 * @example
 * await deleteVenue({ venueId: 'venue-123' });
 */
export async function deleteVenue(params: DeleteVenueParams): Promise<void> {
  const { error } = await supabase
    .from('venues')
    .update({ is_active: false })
    .eq('id', params.venueId);

  if (error) {
    throw new Error(`Failed to delete venue: ${error.message}`);
  }
}
