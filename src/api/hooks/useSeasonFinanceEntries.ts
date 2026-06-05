/**
 * @fileoverview Hooks for the season's finance line-item table.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSeasonFinanceEntries, type SeasonFinanceEntryRow } from '../queries/seasonFinanceEntries';
import { addFinanceEntry, deleteFinanceEntry, type AddFinanceEntryParams } from '../mutations/seasonFinanceEntries';

export function useSeasonFinanceEntries(seasonId: string | undefined) {
  return useQuery<SeasonFinanceEntryRow[]>({
    queryKey: ['seasonFinanceEntries', seasonId],
    queryFn: () => getSeasonFinanceEntries(seasonId!),
    enabled: !!seasonId,
    staleTime: 30 * 1000,
  });
}

export function useAddFinanceEntry() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, AddFinanceEntryParams>({
    mutationFn: addFinanceEntry,
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ['seasonFinanceEntries', vars.seasonId],
        refetchType: 'all',
      });
    },
  });
}

export function useDeleteFinanceEntry() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { entryId: string; seasonId: string }>({
    mutationFn: ({ entryId }) => deleteFinanceEntry(entryId),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ['seasonFinanceEntries', vars.seasonId],
        refetchType: 'all',
      });
    },
  });
}
