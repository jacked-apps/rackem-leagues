/**
 * @fileoverview Conversation Query Functions
 *
 * Pure data fetching functions for conversation-related queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 *
 * @see api/hooks/useConversationQueries.ts - React hook wrapper
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/**
 * Conversation type information
 */
export interface ConversationType {
  conversationType: string | null;
  autoManaged: boolean;
}

/**
 * Conversation title information
 */
export interface ConversationTitle {
  title: string | null;
}

/**
 * Fetch conversation title
 *
 * Gets the title of a conversation (used for group chats and announcements).
 * DM conversations typically don't have titles.
 *
 * @param conversationId - Conversation's primary key ID
 * @returns Conversation title (null for DMs)
 * @throws Error if conversation not found or database error
 *
 * @example
 * const { title } = await getConversationTitle('conv-uuid');
 * const displayName = title || 'Direct Message';
 */
export async function getConversationTitle(conversationId: string): Promise<ConversationTitle> {
  const { data, error } = await supabase
    .from('conversations')
    .select('title')
    .eq('id', conversationId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch conversation title: ${error.message}`);
  }

  return {
    title: data.title,
  };
}

/**
 * Fetch conversation type and auto-managed status
 *
 * Gets conversation metadata to determine if it's a DM, group, or auto-managed conversation
 * (team chat, captain chat, announcements).
 *
 * @param conversationId - Conversation's primary key ID
 * @returns Conversation type information
 * @throws Error if conversation not found or database error
 *
 * @example
 * const typeInfo = await getConversationType('conv-uuid');
 * if (typeInfo.autoManaged) {
 *   console.log('This is a system-managed conversation');
 * }
 */
export async function getConversationType(conversationId: string): Promise<ConversationType> {
  const { data, error } = await supabase
    .from('conversations')
    .select('conversation_type, auto_managed')
    .eq('id', conversationId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch conversation type: ${error.message}`);
  }

  return {
    conversationType: data.conversation_type,
    autoManaged: data.auto_managed,
  };
}

/**
 * Check if a user is blocked by the current user
 *
 * Determines whether the current user has blocked another user.
 * Used to prevent blocked users from appearing in search or conversation lists.
 *
 * @param userId - Current user's member ID
 * @param otherUserId - Other user's member ID to check
 * @returns True if user is blocked, false otherwise
 * @throws Error if database query fails
 *
 * @example
 * const isBlocked = await isUserBlocked('member-123', 'member-456');
 * if (isBlocked) {
 *   console.log('This user is blocked');
 * }
 */
export async function isUserBlocked(userId: string, otherUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocker_id')
    .eq('blocker_id', userId)
    .eq('blocked_id', otherUserId)
    .maybeSingle();

  if (error) {
    logger.error('Error checking if user is blocked', { error: error.message });
    throw new Error(`Failed to check if user is blocked: ${error.message}`);
  }

  return !!data;
}

/**
 * Get other participant ID in a DM conversation
 *
 * For direct message conversations, returns the ID of the other participant
 * (not the current user).
 *
 * @param conversationId - Conversation's primary key ID
 * @param currentUserId - Current user's member ID
 * @returns Other participant's member ID, or null if not a DM or not found
 * @throws Error if database query fails
 *
 * @example
 * const otherUserId = await getOtherParticipantId('conv-uuid', 'member-123');
 * if (otherUserId) {
 *   console.log('Chatting with:', otherUserId);
 * }
 */
export async function getOtherParticipantId(
  conversationId: string,
  currentUserId: string
): Promise<string | null> {
  const { data: participants, error } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .is('left_at', null);

  if (error) {
    logger.error('Error fetching conversation participants', { error: error.message });
    throw new Error(`Failed to fetch conversation participants: ${error.message}`);
  }

  // DMs have exactly 2 participants
  if (participants && participants.length === 2) {
    const otherParticipant = participants.find((p) => p.user_id !== currentUserId);
    return otherParticipant?.user_id || null;
  }

  return null;
}

/**
 * Participant details with member information
 */
export interface ParticipantDetails {
  userId: string;
  lastReadAt: string | null;
  firstName: string;
  lastName: string;
  systemPlayerNumber: string | null;
}

/**
 * Get conversation participants with member details
 *
 * Fetches all active participants in a conversation with their member info.
 * Returns full participant data including names and last_read_at timestamps.
 *
 * @param conversationId - Conversation's primary key ID
 * @returns Array of participant details
 * @throws Error if database query fails
 *
 * @example
 * const participants = await getConversationParticipants('conv-uuid');
 * participants.forEach(p => {
 *   console.log(`${p.firstName} ${p.lastName} last read at ${p.lastReadAt}`);
 * });
 */
export async function getConversationParticipants(
  conversationId: string
): Promise<ParticipantDetails[]> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select(`
      user_id,
      last_read_at,
      members:user_id (
        id,
        first_name,
        last_name,
        system_player_number
      )
    `)
    .eq('conversation_id', conversationId)
    .is('left_at', null);

  if (error) {
    logger.error('Error loading participants', { error: error.message });
    throw new Error(`Failed to fetch conversation participants: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((p) => {
    const member = Array.isArray(p.members) ? p.members[0] : p.members;
    return {
      userId: p.user_id,
      lastReadAt: p.last_read_at,
      firstName: member?.first_name || '',
      lastName: member?.last_name || '',
      systemPlayerNumber: member?.system_player_number || null,
    };
  });
}
