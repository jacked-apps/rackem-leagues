/**
 * @fileoverview TanStack Query hook for resolved league finance
 * settings. Wraps getLeagueFinances.
 */

import { useQuery } from '@tanstack/react-query';
import { getLeagueFinances, type LeagueFinancesQueryResult } from '../queries/leagueFinances';

export function useLeagueFinances(leagueId: string | undefined) {
  return useQuery<LeagueFinancesQueryResult>({
    queryKey: ['leagueFinances', leagueId],
    queryFn: () => getLeagueFinances(leagueId!),
    enabled: !!leagueId,
    staleTime: 30 * 1000,
  });
}
