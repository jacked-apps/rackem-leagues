/**
 * @fileoverview Organization Mutation Hooks (TanStack Query)
 *
 * React hooks for creating and updating organization settings and preferences.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateOrganizationProfanityFilter,
  createOrganization,
  type CreateOrganizationParams,
} from '../mutations/organizations';

/**
 * Hook to update organization's profanity filter setting
 *
 * Invalidates organization queries on success.
 *
 * @example
 * const updateFilter = useUpdateOrganizationProfanityFilter();
 * await updateFilter.mutateAsync({
 *   organizationId: 'org-id',
 *   enabled: true
 * });
 */
export function useUpdateOrganizationProfanityFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { organizationId: string; enabled: boolean }) =>
      updateOrganizationProfanityFilter(params.organizationId, params.enabled),
    onSuccess: (data) => {
      // Invalidate organization query
      queryClient.invalidateQueries({
        queryKey: ['organization', data.id],
      });
    },
  });
}

/**
 * Hook to create a new organization
 *
 * Creates an organization and automatically creates the owner staff record
 * via database trigger. Invalidates organization queries on success.
 *
 * @returns TanStack Mutation object with mutate/mutateAsync functions
 *
 * @example
 * const createOrg = useCreateOrganization();
 *
 * const org = await createOrg.mutateAsync({
 *   organization_name: 'My Pool League',
 *   created_by: member.id,
 *   organization_address: '123 Main St',
 *   organization_city: 'Austin',
 *   organization_state: 'TX',
 *   organization_zip_code: '78701',
 *   organization_email: 'contact@league.com',
 *   organization_phone: '555-0100',
 *   // Payment fields (use generateMockPaymentData() for testing)
 *   stripe_customer_id: 'cus_xxx',
 *   payment_method_id: 'pm_xxx',
 *   card_last4: '4242',
 *   card_brand: 'visa',
 *   expiry_month: 12,
 *   expiry_year: 2025,
 *   billing_zip: '78701'
 * });
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateOrganizationParams) => createOrganization(params),
    onSuccess: async () => {
      // Invalidate AND wait for refetch — closes LIST_FOR_ED #7. The
      // dashboard's org-list query (`useOrganizations(memberId)`) is
      // typically NOT mounted during the LO-application flow, so a
      // plain `invalidateQueries` only marks the cache stale without
      // refetching. The user then navigates to /dashboard, the
      // component mounts, and there's a brief window where the
      // stale data renders before the refetch completes — which is
      // why the new org "doesn't appear until refresh."
      //
      // `refetchType: 'all'` forces a refetch of inactive queries
      // too, and awaiting it inside the async onSuccess holds the
      // mutation open until the cache is genuinely fresh. The
      // LO-application page then navigates with confidence.
      await queryClient.invalidateQueries({
        queryKey: ['organizations'],
        refetchType: 'all',
      });
    },
  });
}
