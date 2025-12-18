/**
 * @fileoverview usePendingReportsCount Hook (TanStack Query wrapper)
 *
 * React hook that fetches the count of pending reports for league operators.
 * Updates in real-time and can be used for notification badges.
 *
 * Now uses TanStack Query internally for caching and state management,
 * with real-time subscription for instant updates.
 */

import { usePendingReportsCount as usePendingReportsQuery } from '@/api/hooks/useReportQueries';

/**
 * Hook to get count of pending reports for a specific organization
 *
 * @param organizationId - Organization ID to filter reports by
 * @returns Count of reports with status 'pending' or 'under_review'
 */
export function usePendingReportsCount(organizationId?: string) {
  const { data: count = 0, isLoading: loading } = usePendingReportsQuery(organizationId);

  return { count, loading };
}
