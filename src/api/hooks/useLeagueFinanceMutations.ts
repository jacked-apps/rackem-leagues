/**
 * @fileoverview Mutation hooks for league finance settings.
 * Both invalidate the leagueFinances cache so the UI updates
 * immediately after a save / reset.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  upsertLeagueFinanceSettings,
  deleteLeagueFinanceSettings,
  type LeagueFinanceSettingsUpsertParams,
} from '../mutations/leagueFinanceSettings';

export function useUpsertLeagueFinanceSettings() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LeagueFinanceSettingsUpsertParams>({
    mutationFn: upsertLeagueFinanceSettings,
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ['leagueFinances', vars.league_id],
        refetchType: 'all',
      });
    },
  });
}

export function useDeleteLeagueFinanceSettings() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { leagueId: string }>({
    mutationFn: ({ leagueId }) => deleteLeagueFinanceSettings(leagueId),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ['leagueFinances', vars.leagueId],
        refetchType: 'all',
      });
    },
  });
}
