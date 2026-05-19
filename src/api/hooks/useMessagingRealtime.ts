/**
 * @fileoverview Messaging Real-time Subscription Hooks
 *
 * Reusable hooks for real-time subscriptions to messaging events.
 * Automatically handles subscription setup, cleanup, and cache invalidation.
 *
 * IMPORTANT: These hooks should ONLY be used on the Messages page (/messages).
 * Real-time channels are expensive - they should open when entering Messages
 * and close when leaving Messages page.
 *
 * For unread counts in navigation/other pages, use the polling-based
 * useUnreadMessageCount hook instead (no real-time subscription).
 *
 * Benefits:
 * - No manual Supabase channel management in components
 * - Automatic cache invalidation on events
 * - Consistent channel naming
 * - Proper cleanup on unmount
 * - Resource-efficient (only active on Messages page)
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '../queryKeys';

/**
 * Subscribe to real-time updates for a user's conversation list
 *
 * Automatically invalidates the conversations cache when:
 * - New messages are inserted (updates last message preview/timestamp)
 * - Conversation participants are updated (updates unread counts)
 *
 * The hook handles subscription setup and cleanup automatically.
 *
 * @param userId - Current user's member ID
 *
 * @example
 * function ConversationList({ userId }) {
 *   const { data: conversations } = useConversations(userId);
 *
 *   // Automatically keeps conversation list fresh
 *   useConversationsRealtime(userId);
 *
 *   return <div>{conversations.map(...)}</div>;
 * }
 */
export function useConversationsRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Subscribe to new messages in any conversation
    // This updates last message preview and timestamp
    const messagesChannel = supabase
      .channel(`conversations-messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Invalidate conversations cache to refetch with updated preview/timestamp
          queryClient.invalidateQueries({
            queryKey: queryKeys.messages.conversations(userId),
          });
        }
      )
      .subscribe();

    // Subscribe to conversation participant updates
    // This updates unread counts when user reads messages
    const participantsChannel = supabase
      .channel(`conversations-participants:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Invalidate conversations cache to refetch with updated unread counts
          queryClient.invalidateQueries({
            queryKey: queryKeys.messages.conversations(userId),
          });
        }
      )
      .subscribe();

    // Cleanup: Remove channels on unmount or userId change
    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [userId, queryClient]);
}

/**
 * Subscribe to real-time updates for messages in a specific conversation
 *
 * Automatically updates the messages cache when:
 * - New messages are inserted
 * - Messages are edited (future feature)
 * - Messages are deleted (future feature)
 *
 * The hook handles subscription setup and cleanup automatically.
 * It also marks messages as read when they arrive.
 *
 * @param conversationId - Conversation's primary key ID
 * @param currentUserId - Current user's member ID (for marking as read)
 *
 * @example
 * function MessageView({ conversationId, currentUserId }) {
 *   const { data: messages } = useConversationMessages(conversationId);
 *   const updateLastReadMutation = useUpdateLastRead();
 *
 *   // Automatically keeps message list fresh
 *   useConversationMessagesRealtime(conversationId, currentUserId, updateLastReadMutation);
 *
 *   return <div>{messages.map(...)}</div>;
 * }
 */
export function useConversationMessagesRealtime(
  conversationId: string | undefined,
  currentUserId: string | undefined,
  updateLastReadMutation?: { mutate: (params: { conversationId: string; userId: string }) => void }
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    // Subscribe to new messages in this conversation
    const channel = supabase
      .channel(`conversation-messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch the complete message with sender info
          const { data, error } = await supabase
            .from('messages')
            .select(`
              id,
              content,
              created_at,
              edited_at,
              is_edited,
              sender:members!sender_id(
                id,
                first_name,
                last_name,
                system_player_number
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (!error && data) {
            // Update TanStack Query cache with new message — dedupe by id
            // so a message can't land twice when both the mutation's
            // invalidation refetch AND the realtime push deliver it
            // (race between the two on the sender side; receiver only
            // gets the realtime push and dedup is a safe no-op for them).
            queryClient.setQueryData(
              queryKeys.messages.byConversation(conversationId),
              (old: any) => {
                const existing = old || [];
                if (existing.some((m: { id: string }) => m.id === data.id)) {
                  return existing;
                }
                return [...existing, data];
              }
            );

            // Update last read if we're viewing the conversation and have mutation hook
            if (currentUserId && updateLastReadMutation) {
              updateLastReadMutation.mutate({
                conversationId,
                userId: currentUserId,
              });
            }
          }
        }
      )
      .subscribe();

    // Cleanup: Remove channel on unmount or conversationId change
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, queryClient, updateLastReadMutation]);
}

