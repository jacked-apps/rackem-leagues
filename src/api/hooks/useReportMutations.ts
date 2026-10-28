/**
 * @fileoverview Report Mutation Hooks
 *
 * TanStack Query mutation hooks for user report operations.
 * Automatically invalidates relevant queries on success.
 *
 * @see api/mutations/reports.ts - Raw mutation functions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createUserReport,
  type CreateReportParams,
} from '../mutations/reports';
import { queryKeys } from '../queryKeys';

/**
 * Hook to create a user report
 *
 * Allows users to report inappropriate behavior.
 * Invalidates report queries on success.
 *
 * @returns Mutation hook with mutate function and state
 *
 * @example
 * function ReportUserButton({ userId }) {
 *   const createReport = useCreateUserReport();
 *
 *   const handleReport = () => {
 *     createReport.mutate({
 *       reporterId: currentUserId,
 *       reportedUserId: userId,
 *       reason: 'harassment',
 *       description: 'User sent inappropriate messages'
 *     }, {
 *       onSuccess: () => {
 *         alert('Report submitted successfully');
 *       }
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleReport} disabled={createReport.isPending}>
 *       {createReport.isPending ? 'Submitting...' : 'Report User'}
 *     </button>
 *   );
 * }
 */
export function useCreateUserReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateReportParams) => createUserReport(params),
    onSuccess: () => {
      // Invalidate reports queries to show new report
      queryClient.invalidateQueries({
        queryKey: queryKeys.reports.all,
      });
    },
  });
}

