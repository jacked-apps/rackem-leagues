/**
 * @fileoverview Organization Staff Mutation Hooks (TanStack Query)
 *
 * React hooks for adding/removing organization staff members.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addOrganizationStaff, removeOrganizationStaff } from '../mutations/organizationStaff';
import { queryKeys } from '../queryKeys';

/**
 * Hook to add a staff member to an organization
 *
 * Invalidates organization staff queries on success.
 *
 * @example
 * const addStaff = useAddOrganizationStaff();
 * await addStaff.mutateAsync({
 *   organizationId: 'org-id',
 *   memberId: 'member-id',
 *   position: 'admin',
 *   addedBy: 'current-user-id'
 * });
 */
export function useAddOrganizationStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      organizationId: string;
      memberId: string;
      position: 'admin' | 'league_rep';
      addedBy: string;
    }) => addOrganizationStaff(
      params.organizationId,
      params.memberId,
      params.position,
      params.addedBy
    ),
    onSuccess: (_, variables) => {
      // Invalidate staff list for this organization
      queryClient.invalidateQueries({
        queryKey: ['organizationStaff', variables.organizationId],
      });
      // The added member's operator access is resolved live from their grants —
      // refresh them so the change is reflected immediately.
      queryClient.invalidateQueries({
        queryKey: queryKeys.permissions.grants(variables.memberId),
      });
    },
  });
}

/**
 * Hook to remove a staff member from an organization
 *
 * Invalidates organization staff queries on success.
 *
 * @example
 * const removeStaff = useRemoveOrganizationStaff();
 * await removeStaff.mutateAsync({
 *   staffId: 'staff-record-id',
 *   memberId: 'member-id',
 *   organizationId: 'org-id'
 * });
 */
export function useRemoveOrganizationStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { staffId: string; memberId: string; organizationId: string }) =>
      removeOrganizationStaff(params.staffId),
    onSuccess: (_, variables) => {
      // Invalidate staff list for this organization
      queryClient.invalidateQueries({
        queryKey: ['organizationStaff', variables.organizationId],
      });
      // The removed member's operator access is resolved live from their grants —
      // refresh them so the change is reflected immediately.
      queryClient.invalidateQueries({
        queryKey: queryKeys.permissions.grants(variables.memberId),
      });
    },
  });
}
