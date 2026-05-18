/**
 * @fileoverview TanStack Query hook wrapping `getNewSeasonPrefill`.
 *
 * Used by the NewSeasonFromPreviousPage to fetch every piece of data
 * the wizard's stages need to pre-populate, in a single round-trip.
 */

import { useQuery } from '@tanstack/react-query';
import { getNewSeasonPrefill, type NewSeasonPrefill } from '../queries/newSeasonPrefill';

export function useNewSeasonPrefill(leagueId: string | undefined) {
  return useQuery<NewSeasonPrefill | null>({
    queryKey: ['newSeasonPrefill', leagueId],
    queryFn: () => getNewSeasonPrefill(leagueId!),
    enabled: !!leagueId,
    // 1 minute — the operator may bounce between this wizard and
    // other pages while planning; not so short that we re-fetch on
    // every focus, not so long that they'd see stale roster data
    // if a captain just edited a team.
    staleTime: 60 * 1000,
  });
}
