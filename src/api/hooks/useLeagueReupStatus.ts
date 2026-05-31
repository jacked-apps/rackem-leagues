/**
 * @fileoverview TanStack Query hook for the LO's re-up status card.
 */

import { useQuery } from '@tanstack/react-query';
import { getLeagueReupStatus, type LeagueReupStatus } from '../queries/leagueReupStatus';

export function useLeagueReupStatus(leagueId: string | undefined) {
  return useQuery<LeagueReupStatus>({
    queryKey: ['leagueReupStatus', leagueId],
    queryFn: () => getLeagueReupStatus(leagueId!),
    enabled: !!leagueId,
    staleTime: 60 * 1000,
  });
}
