/**
 * @fileoverview Member Search Query Hook (TanStack Query)
 *
 * React hook for server-side member search with caching.
 */

import { useQuery } from '@tanstack/react-query';
import { searchMembers, type MemberSearchFilter } from '../queries/memberSearch';
import { STALE_TIME } from '../client';

/**
 * Hook to search for members with server-side filtering
 *
 * Returns top 50 matches based on filter and search.
 * If no search query, returns first 50 members ordered by name.
 *
 * @param searchQuery - Text to search (name or player number), empty string for all
 * @param filter - Which subset of members to search
 * @param organizationId - Current user's organization (for 'my_org' filter)
 * @param userState - Current user's state (for 'state' filter)
 * @param enabled - Whether to run the query (default: true)
 * @param registeredOnly - Only members with a real account. Part of the cache
 *   key, so a caller that wants registered players can't be served a cached
 *   result that includes placeholders.
 * @returns TanStack Query result with array of members
 *
 * @example
 * const { data: members = [], isLoading } = useMemberSearch('john', 'state', null, 'CA');
 * return members.map(m => <MemberCard member={m} />);
 */
export function useMemberSearch(
  searchQuery: string,
  filter: MemberSearchFilter,
  organizationId: string | null,
  userState: string | null,
  enabled: boolean = true,
  registeredOnly: boolean = false
) {
  return useQuery({
    queryKey: [
      'memberSearch',
      searchQuery,
      filter,
      organizationId,
      userState,
      registeredOnly,
    ],
    queryFn: () =>
      searchMembers(searchQuery, filter, organizationId, userState, 50, registeredOnly),
    enabled: enabled, // Run even without search query - will return first 50
    staleTime: STALE_TIME.MEMBER, // 30 minutes
    retry: 1,
  });
}
