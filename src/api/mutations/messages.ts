/**
 * @fileoverview Message Mutation Functions
 *
 * Write operations for messages (send, block, unblock, mark read).
 * These functions are used by TanStack Query useMutation hooks.
 *
 * @see api/hooks/useMessageMutations.ts - React hooks wrapper
 */

import { supabase } from '@/supabaseClient';

/**
 * Parameters for sending a message
 */
export interface SendMessageParams {
  conversationId: string;
  senderId: string;
  content: string;
}

/**
 * Parameters for posting a system-generated message
 */
export interface PostSystemMessageParams {
  conversationId: string;
  content: string;
}

/**
 * Parameters for updating last read timestamp
 */
export interface UpdateLastReadParams {
  conversationId: string;
  userId: string;
}

/**
 * Parameters for blocking a user
 */
export interface BlockUserParams {
  blockerId: string;
  blockedUserId: string;
}

/**
 * Parameters for unblocking a user
 */
export interface UnblockUserParams {
  blockerId: string;
  blockedUserId: string;
}

/**
 * Send a message in a conversation
 *
 * Creates a new message record and updates conversation's last_message_at.
 * Real-time subscriptions will notify other participants.
 *
 * @param params - Message sending parameters
 * @returns The created message record
 * @throws Error if message sending fails
 *
 * @example
 * const message = await sendMessage({
 *   conversationId: 'conv-123',
 *   senderId: 'user-123',
 *   content: 'Hello!'
 * });
 */
export async function sendMessage(params: SendMessageParams) {
  const { conversationId, senderId, content } = params;

  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }

  return data;
}

/**
 * Post a system-generated message into a conversation
 *
 * Used by trigger-driven flows (Unit 4 season-activation trigger posts
 * opening messages; Unit 5 roster triggers post "X joined the team" lines)
 * and by any future operator-side flow that needs to inject narration into
 * a chat without a human sender.
 *
 * System messages have `is_system = true` and `sender_id = NULL` per the
 * messages_is_system_shape CHECK constraint (added in Unit 2 of the
 * messaging overhaul). They render with a distinct visual variant (Unit 7)
 * and do NOT increment unread badges.
 *
 * @param params - Conversation ID and the system message text
 * @returns The created system message row
 * @throws Error if the insert fails (e.g., FK violation, CHECK violation)
 *
 * @example
 * await postSystemMessage({
 *   conversationId: 'conv-123',
 *   content: 'Sally Anderson joined the team.'
 * });
 */
export async function postSystemMessage(params: PostSystemMessageParams) {
  const { conversationId, content } = params;

  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        conversation_id: conversationId,
        sender_id: null,
        content,
        is_system: true,
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to post system message: ${error.message}`);
  }

  return data;
}

/**
 * Update last read timestamp for a user in a conversation
 *
 * Marks messages as read up to current time.
 * Used to calculate unread message counts.
 *
 * @param params - Conversation ID and user ID
 * @throws Error if update fails
 *
 * @example
 * await updateLastRead({
 *   conversationId: 'conv-123',
 *   userId: 'user-123'
 * });
 */
export async function updateLastRead(params: UpdateLastReadParams) {
  const { conversationId, userId } = params;

  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update last read: ${error.message}`);
  }
}

/**
 * Block a user
 *
 * Prevents blocked user from sending messages to blocker.
 * Hides existing conversations with blocked user.
 *
 * @param params - Blocker and blocked user IDs
 * @throws Error if blocking fails
 *
 * @example
 * await blockUser({
 *   blockerId: 'user-123',
 *   blockedUserId: 'user-456'
 * });
 */
export async function blockUser(params: BlockUserParams) {
  const { blockerId, blockedUserId } = params;

  const { error } = await supabase
    .from('blocked_users')
    .insert([
      {
        blocker_id: blockerId,
        blocked_user_id: blockedUserId,
        blocked_at: new Date().toISOString(),
      },
    ]);

  if (error) {
    throw new Error(`Failed to block user: ${error.message}`);
  }
}

/**
 * Unblock a user
 *
 * Removes block, allowing user to send messages again.
 *
 * @param params - Blocker and blocked user IDs
 * @throws Error if unblocking fails
 *
 * @example
 * await unblockUser({
 *   blockerId: 'user-123',
 *   blockedUserId: 'user-456'
 * });
 */
export async function unblockUser(params: UnblockUserParams) {
  const { blockerId, blockedUserId } = params;

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedUserId);

  if (error) {
    throw new Error(`Failed to unblock user: ${error.message}`);
  }
}
