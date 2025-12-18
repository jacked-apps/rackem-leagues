/**
 * @fileoverview Reporting System Query Functions
 *
 * Functions for creating and managing user reports.
 * Handles evidence preservation, status tracking, and action logging.
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/**
 * Report categories with user-friendly labels
 */
export const REPORT_CATEGORIES = {
  inappropriate_message: 'Inappropriate Message',
  harassment: 'Harassment',
  fake_account: 'Fake Account',
  cheating: 'Cheating',
  poor_sportsmanship: 'Poor Sportsmanship',
  impersonation: 'Impersonation',
  spam: 'Spam',
  other: 'Other'
} as const;

export type ReportCategory = keyof typeof REPORT_CATEGORIES;

/**
 * Create a new user report
 *
 * Evidence is automatically captured and stored immutably.
 * Report cannot be deleted, only resolved/dismissed.
 *
 * @param reporterId - Member ID of person filing report
 * @param reportedUserId - Member ID of person being reported
 * @param category - Type of violation
 * @param description - Reporter's description of issue
 * @param evidenceSnapshot - Snapshot of content (message text, match data, etc.)
 * @param contextData - Additional context (conversation_id, match_id, etc.)
 * @returns Promise with report ID and any error
 */
export async function createUserReport(
  reporterId: string,
  reportedUserId: string,
  category: ReportCategory,
  description: string,
  evidenceSnapshot?: Record<string, any>,
  contextData?: Record<string, any>
) {
  const { data, error } = await supabase
    .from('user_reports')
    .insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      category,
      description,
      evidence_snapshot: evidenceSnapshot || null,
      context_data: contextData || null,
      status: 'pending',
      severity: 'medium' // Default, can be adjusted by operators
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Error creating report', { error: error.message });
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Report a message for inappropriate content
 *
 * Automatically captures message content as evidence.
 *
 * @param reporterId - Member ID filing report
 * @param reportedUserId - Member ID who sent the message
 * @param messageId - Message ID
 * @param messageContent - Content of the message (before any filtering)
 * @param conversationId - Conversation where message was sent
 * @param description - Why the message is being reported
 * @returns Promise with report ID and any error
 */
export async function reportMessage(
  reporterId: string,
  reportedUserId: string,
  messageId: string,
  messageContent: string,
  conversationId: string,
  description: string
) {
  return createUserReport(
    reporterId,
    reportedUserId,
    'inappropriate_message',
    description,
    {
      message_id: messageId,
      message_content: messageContent,
      timestamp: new Date().toISOString()
    },
    {
      conversation_id: conversationId
    }
  );
}

/**
 * Get all reports filed by current user
 *
 * @param userId - Member ID
 * @returns Promise with array of reports and any error
 */
export async function getMyReports(userId: string) {
  const { data, error } = await supabase
    .from('user_reports')
    .select(`
      id,
      category,
      description,
      status,
      severity,
      created_at,
      reviewed_at,
      resolved_at,
      reported_user:members!reported_user_id(
        id,
        first_name,
        last_name,
        system_player_number
      )
    `)
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error fetching user reports', { error: error.message });
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Get pending reports for operator review
 *
 * Operators only see reports assigned to their organization.
 *
 * @param organizationId - Organization ID to filter reports by
 * @returns Promise with array of pending reports and any error
 */
export async function getPendingReportsForOperator(organizationId: string) {
  const { data, error } = await supabase
    .from('user_reports')
    .select(`
      id,
      category,
      description,
      severity,
      created_at,
      evidence_snapshot,
      context_data,
      reporter:members!reporter_id(
        id,
        first_name,
        last_name,
        system_player_number
      ),
      reported_user:members!reported_user_id(
        id,
        first_name,
        last_name,
        system_player_number
      )
    `)
    .eq('assigned_organization_id', organizationId)
    .in('status', ['pending', 'under_review'])
    .order('severity', { ascending: false })
    .order('created_at', { ascending: true }); // Oldest first

  if (error) {
    logger.error('Error fetching pending reports', { error: error.message });
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Update report status
 *
 * Status changes are automatically logged in report_updates table.
 *
 * @param reportId - Report ID
 * @param newStatus - New status
 * @returns Promise with any error
 */
export async function updateReportStatus(
  reportId: string,
  newStatus: 'pending' | 'under_review' | 'escalated' | 'action_taken' | 'resolved' | 'dismissed'
) {
  const { error } = await supabase
    .from('user_reports')
    .update({ status: newStatus })
    .eq('id', reportId);

  if (error) {
    logger.error('Error updating report status', { error: error.message });
    return { error };
  }

  // Note: report_updates entry is created automatically by trigger

  return { error: null };
}

/**
 * Take action on a report
 *
 * Records the action taken (warning, suspension, ban) in audit trail.
 *
 * @param reportId - Report ID
 * @param actorId - Member ID taking action
 * @param actorRole - 'operator' or 'developer'
 * @param actionType - Type of action taken
 * @param actionNotes - Why this action was taken
 * @param suspensionUntil - For temporary suspensions, when it expires
 * @returns Promise with any error
 */
export async function takeReportAction(
  reportId: string,
  actorId: string,
  actorRole: 'operator' | 'developer',
  actionType: 'warning' | 'temporary_suspension' | 'permanent_ban' | 'account_deletion' | 'no_action',
  actionNotes: string,
  suspensionUntil?: string
) {
  // Insert action record
  const { error: actionError } = await supabase
    .from('report_actions')
    .insert({
      report_id: reportId,
      actor_id: actorId,
      actor_role: actorRole,
      action_type: actionType,
      action_notes: actionNotes,
      suspension_until: suspensionUntil || null
    });

  if (actionError) {
    logger.error('Error recording report action', { error: actionError.message });
    return { error: actionError };
  }

  // Update report status to action_taken
  const { error: statusError } = await updateReportStatus(reportId, 'action_taken');

  if (statusError) {
    return { error: statusError };
  }

  return { error: null };
}

/**
 * Escalate report to developer
 *
 * For serious issues that require developer attention.
 *
 * @param reportId - Report ID
 * @returns Promise with any error
 */
export async function escalateReport(reportId: string) {
  const { error } = await supabase
    .from('user_reports')
    .update({
      status: 'escalated',
      escalated_to_dev: true
    })
    .eq('id', reportId);

  if (error) {
    logger.error('Error escalating report', { error: error.message });
    return { error };
  }

  return { error: null };
}

/**
 * Get full report details including history
 *
 * Includes all status changes and actions taken.
 *
 * @param reportId - Report ID
 * @returns Promise with report details and any error
 */
export async function getReportDetails(reportId: string) {
  // Get main report
  const { data: report, error: reportError } = await supabase
    .from('user_reports')
    .select(`
      *,
      reporter:members!reporter_id(
        id,
        first_name,
        last_name,
        system_player_number,
        email
      ),
      reported_user:members!reported_user_id(
        id,
        first_name,
        last_name,
        system_player_number,
        email
      ),
      assigned_operator:organizations(
        id,
        organization_name
      )
    `)
    .eq('id', reportId)
    .single();

  if (reportError) {
    logger.error('Error fetching report details', { error: reportError.message });
    return { data: null, error: reportError };
  }

  // Get status history
  const { data: updates, error: updatesError } = await supabase
    .from('report_updates')
    .select(`
      *,
      updater:members!updater_id(
        first_name,
        last_name
      )
    `)
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });

  if (updatesError) {
    logger.error('Error fetching report updates', { error: updatesError.message });
  }

  // Get actions taken
  const { data: actions, error: actionsError } = await supabase
    .from('report_actions')
    .select(`
      *,
      actor:members!actor_id(
        first_name,
        last_name
      )
    `)
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });

  if (actionsError) {
    logger.error('Error fetching report actions', { error: actionsError.message });
  }

  return {
    data: {
      report,
      updates: updates || [],
      actions: actions || []
    },
    error: null
  };
}
