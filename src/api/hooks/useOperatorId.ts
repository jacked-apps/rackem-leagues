/**
 * @fileoverview useOperatorId Hook (TanStack Query Version)
 *
 * Replaces the old useOperatorId hook with TanStack Query for automatic caching.
 * Fetches operator ID for the current authenticated user.
 *
 * Benefits over old version:
 * - Cached for 15 minutes (operator ID doesn't change)
 * - Automatically deduplicates across operator dashboard
 * - Better error handling
 * - Loading states managed by TanStack Query
 *
 * @example
 * const { data: operatorId, isLoading } = useOperatorId();
 * if (operatorId) {
 *   // Fetch leagues for this operator
 * }
 */

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/context/useUser';
import { queryKeys } from '../queryKeys';
import { getOperatorIdByUserId } from '../queries/members';
import { STALE_TIME } from '../client';

/**
 * Hook to get operator ID for current authenticated user
 *
 * This hook:
 * - Gets auth user from context
 * - Fetches member record
 * - Fetches operator record
 * - Returns operator ID
 * - Caches for 15 minutes
 *
 * @returns TanStack Query result with operator ID
 * @returns {object} data - Object with operator ID: { id: string }
 * @returns {boolean} isLoading - True while fetching
 * @returns {boolean} isError - True if fetch failed (user might not be an operator)
 * @returns {Error} error - Error object if fetch failed
 */
export function useOperatorId() {
  const { user } = useUser();

  return useQuery({
    queryKey: queryKeys.operators.id(user?.id || ''),
    queryFn: () => getOperatorIdByUserId(user!.id),
    enabled: !!user?.id,
    staleTime: STALE_TIME.MEMBER, // 15 minutes
    retry: (failureCount, error: Error & { code?: string }) => {
      // Don't retry if not an operator (PGRST116 = no rows)
      if (error?.code === 'PGRST116') return false;
      return failureCount < 1;
    },
    refetchOnWindowFocus: false,
  });
}

/**
 * Convenience hook to get just the operator ID string
 *
 * Returns null if not loaded or user is not an operator.
 *
 * @returns Operator ID or null
 *
 * @example
 * const operatorId = useOperatorIdValue();
 * if (operatorId) {
 *   // User is an operator
 * }
 */
export function useOperatorIdValue(): string | null {
  const { data } = useOperatorId();
  return data?.id || null;
}

/**
 * Hook to check if current user is an operator
 *
 * Returns false while loading, true if operator ID found.
 *
 * @returns True if user is an operator
 *
 * @example
 * const isOperator = useIsCurrentUserOperator();
 * if (!isOperator) {
 *   return <Navigate to="/" />;
 * }
 */
export function useIsCurrentUserOperator(): boolean {
  const { data, isLoading } = useOperatorId();

  // Return false while loading to prevent flashing unauthorized content
  if (isLoading) return false;

  return !!data?.id;
}
