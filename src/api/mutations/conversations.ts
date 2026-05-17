/**
 * @fileoverview Conversation Mutation Functions
 *
 * Write operations for conversations (create DM, create group, leave).
 * These functions are used by TanStack Query useMutation hooks.
 *
 * @see api/hooks/useConversationMutations.ts - React hooks wrapper
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/**
 * Parameters for creating or opening a DM conversation
 */
export interface CreateOrOpenConversationParams {
  userId1: string;
  userId2: string;
}

/**
 * Parameters for creating a group conversation
 */
export interface CreateGroupConversationParams {
  creatorId: string;
  groupName: string;
  memberIds: string[];
}

/**
 * Parameters for leaving a conversation
 */
export interface LeaveConversationParams {
  conversationId: string;
  userId: string;
}

/**
 * Parameters for editing a conversation's title (Unit 19).
 */
export interface UpdateConversationTitleParams {
  conversationId: string;
  /** Acting user's member id. Used to check permission (only the
   *  captain — the cannot_leave=true participant on a team chat —
   *  is allowed to rename it). */
  userId: string;
  /** New title. Trimmed + length-validated (1..80 chars after trim)
   *  before the UPDATE. */
  title: string;
}

/** Max title length the UI accepts (DB column is varchar(200); we
 *  enforce a tighter 80 for mobile readability). */
export const CONVERSATION_TITLE_MAX_LENGTH = 80;

/**
 * Result returned from conversation creation
 */
export interface ConversationResult {
  conversationId: string;
}

/**
 * Create a new direct message conversation or open existing one
 *
 * Checks if a DM conversation already exists between two users.
 * If it exists, returns the existing conversation.
 * If not, creates a new conversation and adds both participants.
 *
 * Uses database function with SECURITY DEFINER to bypass RLS policies.
 *
 * @param params - User IDs for the DM
 * @returns Promise resolving to conversation ID
 * @throws Error if database operation fails
 *
 * @example
 * const result = await createOrOpenConversation({
 *   userId1: 'member-123',
 *   userId2: 'member-456',
 * });
 * console.log('Conversation ID:', result.conversationId);
 */
export async function createOrOpenConversation(
  params: CreateOrOpenConversationParams
): Promise<ConversationResult> {
  const { userId1, userId2 } = params;

  // Call the database function that handles conversation creation with SECURITY DEFINER
  // This bypasses RLS policies while still maintaining security
  const { data, error } = await supabase.rpc('create_dm_conversation', {
    user1_id: userId1,
    user2_id: userId2,
  });

  if (error) {
    logger.error('Error creating/opening conversation', { error: error.message });
    throw new Error(`Failed to create/open conversation: ${error.message}`);
  }

  return { conversationId: data };
}

/**
 * Create a new group conversation
 *
 * Creates a group conversation with a title and adds all specified members.
 * Uses a database function with SECURITY DEFINER to bypass RLS policies.
 *
 * @param params - Creator ID, group name, and member IDs
 * @returns Promise resolving to conversation ID
 * @throws Error if database operation fails or validation fails
 *
 * @example
 * const result = await createGroupConversation({
 *   creatorId: 'member-123',
 *   groupName: 'Team Captains',
 *   memberIds: ['member-123', 'member-456', 'member-789'],
 * });
 */
export async function createGroupConversation(
  params: CreateGroupConversationParams
): Promise<ConversationResult> {
  const { creatorId, groupName, memberIds } = params;

  // Validate group name
  if (!groupName || groupName.trim().length === 0) {
    throw new Error('Group name is required');
  }

  // Validate member count (minimum 2 participants)
  if (!memberIds || memberIds.length < 2) {
    throw new Error('Group conversation requires at least 2 members');
  }

  // Call the database function that handles group creation with SECURITY DEFINER
  // This bypasses RLS policies while still maintaining security
  const { data, error } = await supabase.rpc('create_group_conversation', {
    creator_id: creatorId,
    group_name: groupName.trim(),
    member_ids: memberIds,
  });

  if (error) {
    logger.error('Error creating group conversation', { error: error.message });
    throw new Error(`Failed to create group conversation: ${error.message}`);
  }

  return { conversationId: data };
}

/**
 * Leave a conversation
 *
 * Sets the left_at timestamp for the user in this conversation.
 * The conversation will no longer appear in their list, but messages remain in the database.
 * User can rejoin by starting a new conversation with the same person(s).
 *
 * @param params - Conversation ID and user ID
 * @returns Promise resolving when operation completes
 * @throws Error if database operation fails
 *
 * @example
 * await leaveConversation({
 *   conversationId: 'conv-123',
 *   userId: 'member-456',
 * });
 */
export async function leaveConversation(
  params: LeaveConversationParams
): Promise<void> {
  const { conversationId, userId } = params;

  // Unit 12: guard against captains leaving chats they own
  // (cannot_leave = TRUE — set by the season-activation trigger for
  // team chats + captains chat). The UI hides the Leave option via
  // useMessageComposerStatus.cannotLeave, but a determined caller
  // could still hit this mutation directly — check the flag before
  // doing the UPDATE.
  //
  // Defense-in-depth note: a fully-determined attacker bypassing this
  // mutation and calling `.update()` on conversation_participants
  // directly is still possible until RLS lands (LIST_FOR_ED #29 will
  // close this at the data layer). Today this is the casual-bypass
  // gate plus a hint to whoever later writes the RLS policy.
  const { data: participant, error: pErr } = await supabase
    .from('conversation_participants')
    .select('cannot_leave, left_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (pErr) {
    logger.error('Failed to load participant before leave', { error: pErr.message });
    throw new Error(`Failed to leave conversation: ${pErr.message}`);
  }
  if (!participant) {
    throw new Error('You are not a participant of this conversation.');
  }
  if (participant.left_at !== null) {
    // Already a past-member — treat as a no-op rather than a hard error.
    return;
  }
  if (participant.cannot_leave === true) {
    throw new Error(
      'You cannot leave this conversation while you have a role here (e.g., captain).',
    );
  }

  const { error } = await supabase
    .from('conversation_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) {
    logger.error('Error leaving conversation', { error: error.message });
    throw new Error(`Failed to leave conversation: ${error.message}`);
  }
}

/**
 * Rename a conversation (Unit 19 — editable team chat title).
 *
 * Permissioned: only the captain of a team chat may rename it.
 * "Captain" here means the participant on this conversation whose
 * `cannot_leave = TRUE`. Other chat types (DMs, captains chat,
 * announcements) are NOT user-renamable in this phase.
 *
 * Stamps `title_user_edited_at = NOW()` so the future Unit 15
 * auto-rename trigger leaves this row's title alone going forward
 * (entity renames no longer propagate over a user-set title).
 *
 * @throws Error on validation failure, permission failure, or DB error.
 */
export async function updateConversationTitle(
  params: UpdateConversationTitleParams,
): Promise<void> {
  const { conversationId, userId, title } = params;

  // 1. Validate the new title.
  const trimmed = (title ?? '').trim();
  if (trimmed.length === 0) {
    throw new Error('Title cannot be empty.');
  }
  if (trimmed.length > CONVERSATION_TITLE_MAX_LENGTH) {
    throw new Error(
      `Title is too long (max ${CONVERSATION_TITLE_MAX_LENGTH} characters).`,
    );
  }

  // 2. Check the conversation type — only team_chat is renamable in
  //    this phase (per Unit 19 plan).
  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .select('conversation_type')
    .eq('id', conversationId)
    .single();

  if (cErr || !conv) {
    throw new Error(`Conversation not found: ${cErr?.message ?? 'unknown'}`);
  }
  if (conv.conversation_type !== 'team_chat') {
    throw new Error('Only team chats can be renamed.');
  }

  // 3. Check permission — the actor must have cannot_leave=true on this
  //    conversation (the captain rule from Unit 5's roster triggers).
  const { data: participant, error: pErr } = await supabase
    .from('conversation_participants')
    .select('cannot_leave, left_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (pErr) {
    throw new Error(`Failed to verify permission: ${pErr.message}`);
  }
  if (!participant || participant.left_at !== null) {
    throw new Error('You are not an active participant of this conversation.');
  }
  if (participant.cannot_leave !== true) {
    throw new Error('Only the team captain can rename this chat.');
  }

  // 4. Do the update — stamp title_user_edited_at so the future Unit 15
  //    auto-rename trigger respects the user's choice.
  const { error } = await supabase
    .from('conversations')
    .update({
      title: trimmed,
      title_user_edited_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) {
    logger.error('Error updating conversation title', { error: error.message });
    throw new Error(`Failed to update title: ${error.message}`);
  }
}
