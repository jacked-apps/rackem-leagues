/**
 * @fileoverview TanStack Query mutation hooks for the designations store.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { grantDesignation, type GrantDesignationInput } from '../mutations/designations';

/**
 * Grant a designation to a member (e.g. 'host' after a purchase).
 *
 * Refreshes that member's designations so the new capability lights up
 * immediately (the profile hook's hasDesignation resolves live from them).
 */
export function useGrantDesignation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GrantDesignationInput) => grantDesignation(input),
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.designations.byMember(input.memberId),
      });
    },
  });
}
