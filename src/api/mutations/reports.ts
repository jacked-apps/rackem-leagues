/**
 * @fileoverview Report Mutation Functions
 *
 * Write operations for user reports (create, update status).
 * These functions are used by TanStack Query useMutation hooks.
 *
 * @see api/hooks/useReportMutations.ts - React hooks wrapper
 */

import { supabase } from '@/supabaseClient';
import type { Json } from '@/types/database.types';

/**
 * Report categories
 * Must match the categories in utils/reportingQueries.ts
 */
export type ReportCategory =
  | 'harassment'
  | 'cheating'
  | 'inappropriate_message'
  | 'spam'
  | 'fake_account'
  | 'poor_sportsmanship'
  | 'impersonation'
  | 'other';

/**
 * Parameters for creating a user report
 */
export interface CreateReportParams {
  reporterId: string;
  reportedUserId: string;
  category: ReportCategory;
  description: string;
  evidenceSnapshot?: { [key: string]: Json | undefined };
  contextData?: { [key: string]: Json | undefined };
}

/**
 * Parameters for updating report status
 */
export interface UpdateReportStatusParams {
  reportId: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  reviewNotes?: string;
  reviewedBy?: string;
}

/**
 * Create a new user report
 *
 * Allows users to report inappropriate behavior or content.
 * Reports start in 'pending' status and are reviewed by operators.
 * Evidence is automatically captured and stored immutably.
 *
 * @param params - Report creation parameters
 * @returns The created report record
 * @throws Error if report creation fails
 *
 * @example
 * const report = await createUserReport({
 *   reporterId: 'reporter-id',
 *   reportedUserId: 'reported-user-id',
 *   category: 'harassment',
 *   description: 'User sent inappropriate messages',
 *   evidenceSnapshot: { message_text: 'offensive content' },
 *   contextData: { conversation_id: 'conv-123' }
 * });
 */
export async function createUserReport(params: CreateReportParams) {
  const { reporterId, reportedUserId, category, description, evidenceSnapshot, contextData } = params;

  const { data, error } = await supabase
    .from('user_reports')
    .insert([
      {
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        category,
        description,
        evidence_snapshot: evidenceSnapshot || null,
        context_data: contextData || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user report: ${error.message}`);
  }

  return data;
}

/**
 * Update the status of a user report
 *
 * Used by operators to update report status during investigation.
 * Can add review notes and track who reviewed it.
 *
 * @param params - Report ID, new status, and optional notes
 * @returns The updated report record
 * @throws Error if update fails
 *
 * @example
 * const updated = await updateReportStatus({
 *   reportId: 'report-123',
 *   status: 'resolved',
 *   reviewNotes: 'User warned, no further action needed',
 *   reviewedBy: 'operator-id'
 * });
 */
export async function updateReportStatus(params: UpdateReportStatusParams) {
  const { reportId, status, reviewNotes, reviewedBy } = params;

  // TODO(typed-client): this writes columns user_reports doesn't have
  // (review_notes, reviewed_by) and allows 'investigating', which isn't a
  // report_status — every call would fail. Nothing calls it today
  // (useUpdateReportStatus has no callers; the report screens use
  // utils/reportingQueries.updateReportStatus). Kept as-is.
  const updateData: Record<string, string> = {
    status,
    reviewed_at: new Date().toISOString(),
  };

  if (reviewNotes !== undefined) {
    updateData.review_notes = reviewNotes;
  }

  if (reviewedBy !== undefined) {
    updateData.reviewed_by = reviewedBy;
  }

  const { data, error } = await supabase
    .from('user_reports')
    .update(updateData)
    .eq('id', reportId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update report status: ${error.message}`);
  }

  return data;
}
