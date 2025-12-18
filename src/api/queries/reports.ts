/**
 * @fileoverview Report Query Functions
 *
 * Pure data fetching functions for user report-related queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 */

import { supabase } from '@/supabaseClient';

/**
 * Fetch count of pending user reports for an organization
 *
 * Gets count of reports with status 'pending' or 'under_review'.
 * Used for notification badges in operator navigation.
 *
 * @param organizationId - Optional organization ID to filter by
 * @returns Number of pending reports
 * @throws Error if database query fails
 *
 * @example
 * const count = await getPendingReportsCount('org-123');
 * console.log(`${count} reports awaiting review`);
 */
export async function getPendingReportsCount(organizationId?: string): Promise<number> {
  let query = supabase
    .from('user_reports')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'under_review']);

  // Filter by organization if provided
  if (organizationId) {
    query = query.eq('assigned_organization_id', organizationId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch pending reports count: ${error.message}`);
  }

  return count || 0;
}
