/**
 * @fileoverview Report Mutation Functions
 *
 * Write operations for user reports (create).
 * These functions are used by TanStack Query useMutation hooks.
 *
 * @see api/hooks/useReportMutations.ts - React hooks wrapper
 */

import { supabase } from '@/supabaseClient';

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
  evidenceSnapshot?: Record<string, any>;
  contextData?: Record<string, any>;
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
