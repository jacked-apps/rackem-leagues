/**
 * @fileoverview useUserProfile Hook (TanStack Query Version)
 *
 * Replaces the old useUserProfile hook with TanStack Query for automatic caching.
 * Fetches complete member profile with all fields and provides role-checking utilities.
 *
 * Benefits over old version:
 * - Automatic caching (30 minute stale time)
 * - No manual refresh trigger needed (use invalidateQueries instead)
 * - Background refetching
 * - Better error handling
 * - Shares cache with other profile queries
 *
 * @example
 * const { data: member, isLoading, hasRole, canAccessOperatorFeatures } = useUserProfile();
 *
 * if (canAccessOperatorFeatures()) {
 *   // Show operator nav
 * }
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/context/useUser';
import { queryKeys } from '../queryKeys';
import { getMemberProfile } from '../queries/members';
import { getMemberStaffGrants } from '../queries/permissions';
import { getMemberDesignations } from '../queries/designations';
import { hasOperatorAccess } from '../permissions/permissions';
import { STALE_TIME } from '../client';
import type { Member, UserRole } from '@/types';

/**
 * Result type for useUserProfile hook
 * Extends TanStack Query result with utility functions
 */
interface UseUserProfileResult {
  /** Complete member record (null if not found) */
  member: Member | null;
  /** True while fetching */
  loading: boolean;
  /** Error message if fetch fails */
  error: string | null;
  /** True if member not found (user needs to complete application) */
  needsApplication: boolean;
  /** Check if member has specific role */
  hasRole: (role: UserRole) => boolean;
  /** Check if member can access league operator features */
  canAccessLeagueOperatorFeatures: () => boolean;
  /** Check if member can access developer features */
  canAccessDeveloperFeatures: () => boolean;
  /**
   * Check if the member holds a given designation (e.g. 'host', 'developer'),
   * resolved live from the designations store. The generic form behind the
   * developer/host convenience checks.
   */
  hasDesignation: (designation: string) => boolean;
  /** Check if member record exists */
  hasMemberRecord: () => boolean;
  /** Check if user needs to complete application */
  needsToCompleteApplication: () => boolean;
  /** Manually refresh profile data from database */
  refreshProfile: () => Promise<void>;
}

/**
 * Hook to get complete user profile with role utilities
 *
 * This hook:
 * - Fetches complete member record
 * - Handles case where member doesn't exist (PGRST116 error)
 * - Provides role-checking utilities
 * - Caches for 30 minutes
 *
 * @returns Extended hook result with member data and utilities
 */
export function useUserProfile(): UseUserProfileResult {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.members.byUser(user?.id || ''),
    queryFn: () => getMemberProfile(user!.id),
    enabled: !!user?.id,
    staleTime: STALE_TIME.MEMBER,
    retry: (failureCount, error: any) => {
      // Don't retry if member not found (PGRST116 = no rows)
      // This is expected for new users who haven't completed application
      if (error?.code === 'PGRST116') return false;

      // Retry once for other errors
      return failureCount < 1;
    },
    refetchOnWindowFocus: false,
  });

  const member = query.data || null;
  const needsApplication = query.error?.code === 'PGRST116';

  // Operator access is resolved LIVE from the member's organization_staff grants
  // (A3) — not from members.role — so it stays correct the moment staffing
  // changes, with no second copy to hand-sync. Fetched separately for now;
  // folding it into the profile query to save a round trip (A6) is a later
  // optimization that would touch the Member type.
  const grantsQuery = useQuery({
    queryKey: queryKeys.permissions.grants(member?.id || ''),
    queryFn: () => getMemberStaffGrants(member!.id),
    enabled: !!member?.id,
    staleTime: STALE_TIME.MEMBER,
    refetchOnWindowFocus: false,
  });
  const grants = grantsQuery.data ?? [];

  // The developer master key (D7) is resolved LIVE from the designations store,
  // not members.role — the person-level counterpart to resolving operator access
  // from staff grants. Assigned by hand (SQL); no app write path.
  const designationsQuery = useQuery({
    queryKey: queryKeys.designations.byMember(member?.id || ''),
    queryFn: () => getMemberDesignations(member!.id),
    enabled: !!member?.id,
    staleTime: STALE_TIME.MEMBER,
    refetchOnWindowFocus: false,
  });
  const designations = designationsQuery.data ?? [];
  const isDeveloper = designations.includes('developer');

  // While grants OR designations are still loading, callers must treat the
  // profile as loading too — otherwise a route guard would deny an operator or
  // developer during the fetch window and bounce them off their own page.
  const grantsLoading = !!member?.id && grantsQuery.isLoading;
  const designationsLoading = !!member?.id && designationsQuery.isLoading;

  // Utility functions for role and permission checking
  const hasRole = (role: UserRole) => member?.role === role;

  const canAccessLeagueOperatorFeatures = () =>
    hasOperatorAccess({ grants, isDeveloper });

  const canAccessDeveloperFeatures = () => isDeveloper;

  // Generic designation check (host, developer, and future ones). The developer
  // master key also satisfies every designation check by definition (D7).
  const hasDesignation = (designation: string) =>
    isDeveloper || designations.includes(designation);

  const hasMemberRecord = () => member !== null;

  const needsToCompleteApplication = () => needsApplication;

  /**
   * Manually refresh profile data from database
   * Invalidates the cache and refetches from Supabase
   */
  const refreshProfile = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.members.byUser(user?.id || ''),
    });
  };

  return {
    member,
    loading: query.isLoading || grantsLoading || designationsLoading,
    error: query.error ? String(query.error) : null,
    needsApplication,
    hasRole,
    canAccessLeagueOperatorFeatures,
    canAccessDeveloperFeatures,
    hasDesignation,
    hasMemberRecord,
    needsToCompleteApplication,
    refreshProfile,
  };
}

/**
 * Hook to check if current user is a league operator
 *
 * Convenience hook for route protection and conditional rendering.
 *
 * @returns True if user is operator or developer
 *
 * @example
 * const isOperator = useIsOperator();
 * if (!isOperator) return <Navigate to="/" />;
 */
export function useIsOperator(): boolean {
  const { canAccessLeagueOperatorFeatures } = useUserProfile();
  return canAccessLeagueOperatorFeatures();
}

/**
 * Hook to check if current user is a developer
 *
 * @returns True if user has developer role
 */
export function useIsDeveloper(): boolean {
  const { canAccessDeveloperFeatures } = useUserProfile();
  return canAccessDeveloperFeatures();
}

/**
 * Hook to get member's role
 *
 * @returns User's role or null if no member record
 *
 * @example
 * const role = useMemberRole();
 * if (role === 'player') { ... }
 */
export function useMemberRole(): UserRole | null {
  const { member } = useUserProfile();
  return member?.role || null;
}
