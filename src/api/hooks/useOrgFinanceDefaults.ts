/**
 * @fileoverview Hooks for org-level finance defaults.
 *
 * On successful upsert, invalidates not just the org-defaults query
 * but ALL `leagueFinances` queries (any cached league's resolved
 * settings reads from the org default chain).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrgFinanceDefaults } from '../queries/orgFinanceDefaults';
import { upsertOrgFinanceDefaults, type OrgFinanceDefaultsUpsertParams } from '../mutations/orgFinanceDefaults';
import type { OrgFinanceDefaultsRow } from '../queries/leagueFinances';

export function useOrgFinanceDefaults(orgId: string | undefined) {
  return useQuery<OrgFinanceDefaultsRow | null>({
    queryKey: ['orgFinanceDefaults', orgId],
    queryFn: () => getOrgFinanceDefaults(orgId!),
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

export function useUpsertOrgFinanceDefaults() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, OrgFinanceDefaultsUpsertParams>({
    mutationFn: upsertOrgFinanceDefaults,
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['orgFinanceDefaults', vars.organization_id],
          refetchType: 'all',
        }),
        // Any cached league's resolved settings reads from the org defaults,
        // so we invalidate the whole leagueFinances key family.
        queryClient.invalidateQueries({
          queryKey: ['leagueFinances'],
          refetchType: 'all',
        }),
      ]);
    },
  });
}
