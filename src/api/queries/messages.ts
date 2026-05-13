/**
 * @fileoverview Message Query Functions (TanStack Query - Read-Only)
 *
 * Pure data-fetching functions for messaging system.
 * These functions are called by TanStack Query hooks, not directly by components.
 *
 * Phase 1: READ-ONLY operations
 * - Fetch conversations
 * - Fetch messages
 * - Fetch blocked users
 *
 * Phase 2 (Future): MUTATIONS will be added separately
 * - Send messages (useMutation)
 * - Block/unblock users (useMutation)
 * - Leave conversations (useMutation)
 *
 * Migrated from: utils/messageQueries.ts
 */

import { supabase } from '@/supabaseClient';

/**
 * Fetch list of users that the current user has blocked (IDs only)
 *
 * Used to filter out blocked users from conversation lists and searches.
 *
 * @param userId - The member ID to fetch blocked users for
 * @returns Promise with array of blocked user IDs
 * @throws Error if query fails
 */
export async function getBlockedUsers(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);

  if (error) throw error;

  return (data || []).map((block: any) => block.blocked_id);
}

/**
 * Fetch full details of users that the current user has blocked
 *
 * Used in settings/management UI to display blocked users with unblock option.
 * Returns full user info including names and block metadata.
 *
 * @param userId - The member ID to fetch blocked users for
 * @returns Promise with array of blocked user details
 * @throws Error if query fails
 */
export async function getBlockedUsersDetails(userId: string) {
  const { data, error } = await supabase
    .from('blocked_users')
    .select(`
      blocked_id,
      blocked_at,
      reason,
      blocked:members!blocked_id(
        id,
        first_name,
        last_name,
        system_player_number
      )
    `)
    .eq('blocker_id', userId)
    .order('blocked_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

/**
 * Fetch all conversations for a user
 *
 * Returns conversations with:
 * - Conversation metadata (title, type, last message preview)
 * - Unread count for the current user
 * - Last message timestamp for sorting
 * - Display names for DM conversations
 * - Excludes conversations with blocked users
 *
 * Conversations are sorted by most recent message first.
 *
 * @param userId - The member ID to fetch conversations for
 * @returns Promise with formatted conversations array
 * @throws Error if query fails
 */
export async function getUserConversations(userId: string) {
  // First, get list of blocked users
  const blockedUserIds = await getBlockedUsers(userId);

  // Fetch all conversations the user is a participant in
  const { data, error } = await supabase
    .from('conversation_participants')
    .select(`
      conversation_id,
      unread_count,
      last_read_at,
      conversations!inner(
        id,
        title,
        conversation_type,
        scope_type,
        last_message_at,
        last_message_preview,
        created_at
      )
    `)
    .eq('user_id', userId)
    .is('left_at', null) // Only active conversations
    .order('conversations(last_message_at)', { ascending: false, nullsFirst: false });

  if (error) throw error;

  // For each conversation, fetch the other participant's name for DMs and filter blocked users
  const conversationsWithNames = await Promise.all(
    (data || []).map(async (item: any) => {
      let displayName = item.conversations.title;
      let shouldHide = false;

      // If no title (DM conversation), fetch other participant's name
      if (!displayName) {
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select(`
            user_id,
            members:user_id (
              first_name,
              last_name
            )
          `)
          .eq('conversation_id', item.conversations.id)
          .is('left_at', null);

        // Find the other participant (not current user)
        const otherParticipant = participants?.find((p: any) => p.user_id !== userId);

        // Check if the other participant is blocked
        if (otherParticipant && blockedUserIds.includes(otherParticipant.user_id)) {
          shouldHide = true;
        }

        if (otherParticipant?.members && !Array.isArray(otherParticipant.members)) {
          const member = otherParticipant.members as any;
          displayName = `${member.first_name} ${member.last_name}`;
        }
      }

      // Return null for conversations that should be hidden
      if (shouldHide) {
        return null;
      }

      return {
        id: item.conversations.id,
        title: displayName || 'Direct Message',
        conversationType: item.conversations.conversation_type,
        scopeType: item.conversations.scope_type,
        lastMessageAt: item.conversations.last_message_at,
        lastMessagePreview: item.conversations.last_message_preview,
        unreadCount: item.unread_count,
        createdAt: item.conversations.created_at,
      };
    })
  );

  // Filter out null values (blocked conversations)
  return conversationsWithNames.filter((conv) => conv !== null);
}

/**
 * Fetch all messages in a conversation
 *
 * Returns messages with:
 * - Message content and metadata (created_at, edited_at)
 * - Sender information (name, member number)
 * - Edit/delete status
 *
 * Messages are sorted chronologically (oldest first) for chat display.
 * Only returns non-deleted messages.
 *
 * @param conversationId - The conversation ID to fetch messages for
 * @returns Promise with messages array
 * @throws Error if query fails
 */
export async function getConversationMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      content,
      created_at,
      edited_at,
      is_edited,
      is_system,
      sender:members!sender_id(
        id,
        first_name,
        last_name,
        system_player_number
      )
    `)
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data || [];
}

/**
 * Fetch unread message count for a user
 *
 * Sums up unread counts across all active conversations.
 *
 * @param userId - The member ID to fetch unread count for
 * @returns Promise with total unread count
 * @throws Error if query fails
 */
export async function getUnreadMessageCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('unread_count')
    .eq('user_id', userId)
    .is('left_at', null);

  if (error) throw error;

  // Sum up all unread counts
  const total = (data || []).reduce((sum: number, item: any) => {
    return sum + (item.unread_count || 0);
  }, 0);

  return total;
}

/**
 * Fetch participants in a conversation
 *
 * Returns participant information including member details.
 *
 * @param conversationId - The conversation ID to fetch participants for
 * @returns Promise with participants array
 * @throws Error if query fails
 */
export async function getConversationParticipants(conversationId: string) {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select(`
      user_id,
      joined_at,
      left_at,
      is_admin,
      members:user_id (
        id,
        first_name,
        last_name,
        system_player_number
      )
    `)
    .eq('conversation_id', conversationId)
    .is('left_at', null); // Only active participants

  if (error) throw error;

  return data || [];
}
