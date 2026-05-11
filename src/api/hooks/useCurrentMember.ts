/**
 * @fileoverview useCurrentMember Hook (TanStack Query Version)
 *
 * Replaces the old useCurrentMember hook with TanStack Query for automatic caching.
 * Fetches the current authenticated user's member data and caches it across the app.
 *
 * Benefits over old version:
 * - Automatic caching (fetch once, reuse everywhere)
 * - No duplicate requests (deduplication across components)
 * - Background refetching keeps data fresh
 * - Built-in loading/error states
 * - Cached for 30 minutes (configured in client.ts)
 *
 * @example
 * // In any component
 * const { data: member, isLoading, error } = useCurrentMember();
 * if (isLoading) return <LoadingState />;
 * if (error) return <ErrorState error={error} />;
 * return <div>Welcome, {member.first_name}!</div>;
 */

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/context/useUser';
import { queryKeys } from '../queryKeys';
import { getCurrentMember, getIsCaptain, getAllMembers, getMembersByIds, getMemberProfanitySettings, getMemberById } from '../queries/members';
import { STALE_TIME } from '../client';

/**
 * Hook to get current authenticated user's member data
 *
 * This hook:
 * - Gets auth user from UserContext
 * - Fetches complete member record from database (all fields including role)
 * - Caches result for 30 minutes
 * - Only runs when user is authenticated
 * - Shares cache with all other components using this hook
 *
 * @returns TanStack Query result with complete member data
 * @returns {Member} data - Complete member record with all fields including role
 * @returns {boolean} isLoading - True while fetching
 * @returns {boolean} isError - True if fetch failed
 * @returns {Error} error - Error object if fetch failed
 * @returns {boolean} isFetching - True during background refetch
 */
export function useCurrentMember() {
  const { user } = useUser();

  return useQuery({
    // Query key for caching - uses user ID
    queryKey: queryKeys.members.byUser(user?.id || ''),

    // Query function - fetches member data
    queryFn: () => getCurrentMember(user!.id),

    // Only run query if user is authenticated
    enabled: !!user?.id,

    // Keep member data fresh for 30 minutes (very stable data)
    staleTime: STALE_TIME.MEMBER,

    // Retry once on failure
    retry: 1,

    // Don't refetch on window focus for user data (it won't change)
    refetchOnWindowFocus: false,
  });
}

/**
 * Convenience hook to get just the member ID
 *
 * Useful when you only need the ID and don't want to destructure.
 *
 * @returns Member ID or null
 *
 * @example
 * const memberId = useMemberId();
 * if (memberId) {
 *   // Fetch teams for this member
 * }
 */
export function useMemberId(): string | null {
  const { data } = useCurrentMember();
  return data?.id || null;
}

/**
 * Convenience hook to get just the member's first name
 *
 * @returns First name or empty string
 *
 * @example
 * const firstName = useMemberFirstName();
 * return <h1>Welcome, {firstName}!</h1>;
 */
export function useMemberFirstName(): string {
  const { data } = useCurrentMember();
  return data?.first_name || '';
}

/**
 * Hook to check if the current member is a captain of any team
 *
 * Caches for 15 minutes. Useful for showing/hiding captain-specific features
 * like team announcements.
 *
 * @returns Query result with boolean indicating captain status
 *
 * @example
 * const { data: isCaptain = false } = useIsCaptain();
 * {isCaptain && <Button onClick={createAnnouncement}>New Announcement</Button>}
 */
export function useIsCaptain() {
  const { data: member } = useCurrentMember();
  const memberId = member?.id;

  return useQuery({
    queryKey: queryKeys.members.isCaptain(memberId || ''),
    queryFn: () => getIsCaptain(memberId!),
    enabled: !!memberId,
    staleTime: STALE_TIME.MEMBER, // 15 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch all members with user accounts
 *
 * Returns all members who can log in (have linked user accounts).
 * Used for messaging features - showing list of people user can message.
 * Excludes specified member (typically current user).
 *
 * Caches for 5 minutes. Member list doesn't change frequently.
 *
 * @param excludeMemberId - Optional member ID to exclude from results
 * @returns Query result with array of member objects
 *
 * @example
 * const { data: members = [], isLoading } = useAllMembers(currentUserId);
 * // Returns all members except current user
 */
export function useAllMembers(excludeMemberId?: string) {
  return useQuery({
    queryKey: [...queryKeys.members.all, 'messageable', excludeMemberId || 'none'],
    // Messaging context: callers want every registered user (and any
    // BCA-elevated placeholder) regardless of org. Pass undefined for
    // organizationId so the org-scope filter is skipped — registered
    // users span orgs, and messaging needs all of them findable.
    queryFn: () => getAllMembers(undefined, excludeMemberId),
    staleTime: 5 * 60 * 1000, // 5 minutes - member list doesn't change often
    retry: 1,
  });
}

/**
 * Hook to fetch a single member by ID
 *
 * Gets full member record for a specific member ID.
 * Used when you need to fetch a specific member (e.g., substitute player).
 *
 * Caches for 15 minutes. Member data doesn't change frequently.
 *
 * @param memberId - Member's primary key ID
 * @returns Query result with member object
 *
 * @example
 * const { data: member } = useMemberById('member-uuid');
 */
export function useMemberById(memberId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.members.detail(memberId || ''),
    queryFn: () => getMemberById(memberId!),
    enabled: !!memberId,
    staleTime: STALE_TIME.MEMBER, // 15 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch multiple members by IDs
 *
 * Gets member records for a list of member IDs.
 * Returns basic info needed for display (name, nickname).
 * Used by scoring pages to get player names for lineup.
 *
 * Caches for 15 minutes. Player names don't change frequently.
 *
 * @param memberIds - Array of member primary key IDs
 * @returns Query result with array of member objects (id, first_name, last_name, nickname)
 *
 * @example
 * const { data: players = [] } = useMembersByIds(['id1', 'id2', 'id3']);
 * const playerMap = new Map(players.map(p => [p.id, p]));
 */
export function useMembersByIds(memberIds: string[] | undefined | null) {
  return useQuery({
    queryKey: [...queryKeys.members.all, 'byIds', ...(memberIds || []).sort()],
    queryFn: () => getMembersByIds(memberIds!),
    enabled: !!memberIds && memberIds.length > 0,
    staleTime: STALE_TIME.MEMBER, // 15 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get member's profanity filter settings
 *
 * Fetches profanity filter preference for current user.
 * All users can toggle their filter preference.
 *
 * Caches for 30 minutes. Profile data doesn't change frequently.
 *
 * @param userId - Supabase auth user ID (optional)
 * @returns Query result with { profanity_filter_enabled }
 *
 * @example
 * const { data: settings } = useMemberProfanitySettings(user?.id);
 * const shouldFilter = settings.profanity_filter_enabled;
 */
export function useMemberProfanitySettings(userId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.members.byUser(userId || ''), 'profanitySettings'],
    queryFn: () => getMemberProfanitySettings(userId!),
    enabled: !!userId,
    staleTime: STALE_TIME.MEMBER, // 30 minutes
    retry: 1,
  });
}
