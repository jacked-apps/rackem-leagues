/**
 * @fileoverview Venue Duplicate Detection
 *
 * Helper functions to detect potential duplicate venues before creation.
 * Uses the database function find_duplicate_venues() for normalized matching.
 */

import { supabase } from '@/supabaseClient';

/**
 * Potential duplicate venue result
 */
export interface DuplicateVenue {
  id: string;
  name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  total_tables: number;
  created_by_operator_name: string | null;
  is_active: boolean;
}

/**
 * Check if a venue already exists at the given address
 *
 * Uses normalized matching:
 * - Case insensitive
 * - Trimmed whitespace
 * - Normalized zip code format (removes dashes)
 *
 * This prevents operators from accidentally creating duplicate venues
 * for the same physical location.
 *
 * @param streetAddress - Street address to check
 * @param city - City to check
 * @param state - State (2-letter code)
 * @param zipCode - Zip code (with or without dash)
 * @returns Array of potential duplicate venues
 * @throws Error if query fails
 *
 * @example
 * const duplicates = await findDuplicateVenues(
 *   '123 Main Street',
 *   'Springfield',
 *   'IL',
 *   '62701'
 * );
 *
 * if (duplicates.length > 0) {
 *   // Show warning: venue may already exist
 *   // Allow operator to use existing or create new
 * }
 */
export async function findDuplicateVenues(
  streetAddress: string,
  city: string,
  state: string,
  zipCode: string
): Promise<DuplicateVenue[]> {
  // TODO(typed-client): find_duplicate_venues is in no migration (only the
  // hand-run database/fix_venue_persistence.sql), so it isn't in the generated
  // types. Nothing imports this module today.
  const { data, error } = await supabase.rpc('find_duplicate_venues' as never, {
    p_street_address: streetAddress,
    p_city: city,
    p_state: state,
    p_zip_code: zipCode,
  } as never);

  if (error) {
    throw new Error(`Failed to check for duplicate venues: ${error.message}`);
  }

  return (data || []) as unknown as DuplicateVenue[];
}

/**
 * Check if a venue exists and is active
 *
 * Returns only active venues at the given address.
 * Useful for showing "Use existing venue" option during venue creation.
 *
 * @param streetAddress - Street address to check
 * @param city - City to check
 * @param state - State (2-letter code)
 * @param zipCode - Zip code (with or without dash)
 * @returns Array of active venues at this address
 * @throws Error if query fails
 */
export async function findActiveVenuesAtAddress(
  streetAddress: string,
  city: string,
  state: string,
  zipCode: string
): Promise<DuplicateVenue[]> {
  const duplicates = await findDuplicateVenues(streetAddress, city, state, zipCode);
  return duplicates.filter((v) => v.is_active);
}
