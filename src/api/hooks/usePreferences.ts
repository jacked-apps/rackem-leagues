/**
 * @fileoverview Preferences Hooks (TanStack Query)
 *
 * React hooks for fetching organization and league preferences with automatic caching.
 * Uses TanStack Query for state management and caching.
 *
 * Benefits:
 * - Automatic caching (fetch once, reuse everywhere)
 * - No duplicate requests
 * - Built-in loading/error states
 * - Automatic refetching on stale data
 */

import { useQuery } from '@tanstack/react-query';
import { getOrganizationPreferences, getLeaguePreferences } from '../queries/preferences';
import { STALE_TIME } from '../client';

/**
 * Hook to fetch organization preferences by operator ID
 *
 * Fetches organization-level preference defaults.
 * These are used as defaults for league creation wizard and league fallbacks.
 * Cached for 15 minutes.
 *
 * @param operatorId - League operator ID
 * @returns TanStack Query result with organization preferences
 *
 * @example
 * const { data: orgPrefs, isLoading } = useOrganizationPreferences(operatorId);
 *
 * if (isLoading) return <div>Loading preferences...</div>;
 * if (!orgPrefs) return null;
 *
 * // Use org defaults to pre-fill wizard
 * const defaultHandicap = orgPrefs.handicap_variant || 'standard';
 */
export function useOrganizationPreferences(operatorId: string | null | undefined) {
  return useQuery({
    queryKey: ['preferences', 'organization', operatorId],
    queryFn: () => getOrganizationPreferences(operatorId!),
    enabled: !!operatorId,
    staleTime: STALE_TIME.MEMBER, // 15 minutes - preferences don't change often
    retry: 1,
  });
}

/**
 * Hook to fetch league preferences by league ID
 *
 * Fetches league-specific preference overrides.
 * NULL values mean "use organization default".
 * Cached for 15 minutes.
 *
 * @param leagueId - League ID
 * @returns TanStack Query result with league preferences
 *
 * @example
 * const { data: leaguePrefs, isLoading } = useLeaguePreferences(leagueId);
 *
 * if (isLoading) return <div>Loading preferences...</div>;
 * if (!leaguePrefs) return null;
 *
 * // Check for overrides (NULL means use org default)
 * const gameHistoryLimit = leaguePrefs.game_history_limit ?? orgPrefs.game_history_limit ?? 200;
 */
export function useLeaguePreferences(leagueId: string | null | undefined) {
  return useQuery({
    queryKey: ['preferences', 'league', leagueId],
    queryFn: () => getLeaguePreferences(leagueId!),
    enabled: !!leagueId,
    staleTime: STALE_TIME.MEMBER, // 15 minutes
    retry: 1,
  });
}
