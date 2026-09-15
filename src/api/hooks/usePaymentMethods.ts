/**
 * @fileoverview TanStack Query hooks for the per-player card-on-file.
 *
 * `useDefaultPaymentMethod` reads the member's default card (to seed the create
 * flow — is a card already on file?); `useSaveDefaultPaymentMethod` upserts it
 * after a verify and invalidates the read.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getDefaultPaymentMethod } from '../queries/paymentMethods';
import { upsertDefaultPaymentMethod, type SaveCardInput } from '../mutations/paymentMethods';

/** The member's default card on file (or null). Skipped until a memberId exists. */
export function useDefaultPaymentMethod(memberId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.paymentMethods.default(memberId ?? ''),
    queryFn: () => getDefaultPaymentMethod(memberId as string),
    enabled: !!memberId,
  });
}

/** Save (upsert) the member's default card; returns the payment_methods id. */
export function useSaveDefaultPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveCardInput) => upsertDefaultPaymentMethod(input),
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.paymentMethods.default(input.memberId),
      });
    },
  });
}
