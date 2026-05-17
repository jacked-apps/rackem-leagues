/**
 * @fileoverview Conversation Mutation Hooks (TanStack Query)
 *
 * React hooks for conversation mutations (create, leave) with automatic cache invalidation.
 *
 * @see api/mutations/conversations.ts - Pure mutation functions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createOrOpenConversation,
  createGroupConversation,
  leaveConversation,
  updateConversationTitle,
} from '../mutations/conversations';
import { queryKeys } from '../queryKeys';

/**
 * Hook to create or open a direct message conversation
 *
 * Automatically invalidates conversations cache on success.
 * If conversation already exists, returns existing conversation ID.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const createConversationMutation = useCreateOrOpenConversation();
 *
 * const handleStartChat = async () => {
 *   const result = await createConversationMutation.mutateAsync({
 *     userId1: currentUserId,
 *     userId2: selectedUserId,
 *   });
 *   navigate(`/messages?conversation=${result.conversationId}`);
 * };
 */
export function useCreateOrOpenConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOrOpenConversation,
    onSuccess: (_, variables) => {
      // Invalidate conversations list for both users
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.conversations(variables.userId1),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.conversations(variables.userId2),
      });
    },
  });
}

/**
 * Hook to create a new group conversation
 *
 * Automatically invalidates conversations cache for all members on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const createGroupMutation = useCreateGroupConversation();
 *
 * const handleCreateGroup = async () => {
 *   const result = await createGroupMutation.mutateAsync({
 *     creatorId: currentUserId,
 *     groupName: 'Team Captains',
 *     memberIds: [currentUserId, ...selectedUserIds],
 *   });
 *   navigate(`/messages?conversation=${result.conversationId}`);
 * };
 */
export function useCreateGroupConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGroupConversation,
    onSuccess: (_, variables) => {
      // Invalidate conversations list for all members
      variables.memberIds.forEach((memberId) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.messages.conversations(memberId),
        });
      });
    },
  });
}

/**
 * Hook to leave a conversation
 *
 * Automatically invalidates conversations cache for the leaving user on success.
 * Conversation will no longer appear in user's list but messages remain in database.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const leaveConversationMutation = useLeaveConversation();
 *
 * const handleLeave = async () => {
 *   await leaveConversationMutation.mutateAsync({
 *     conversationId: currentConversationId,
 *     userId: currentUserId,
 *   });
 *   navigate('/messages');
 * };
 */
export function useLeaveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leaveConversation,
    onSuccess: (_, variables) => {
      // Invalidate conversations list for the user who left
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.conversations(variables.userId),
      });

      // Also invalidate the specific conversation's messages
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.byConversation(variables.conversationId),
      });
    },
  });
}

/**
 * Hook to rename a conversation (Unit 19 — editable team chat title).
 *
 * Only the team captain (the cannot_leave=true participant on a
 * team_chat) is allowed to rename — the mutation enforces this
 * server-side; the UI hides the edit affordance for non-captains
 * via `useMessageComposerStatus.cannotLeave`.
 *
 * Invalidates the user's conversations list (so the new title
 * shows in the sidebar) and the messages query for this
 * conversation (so any header components re-read).
 */
export function useUpdateConversationTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateConversationTitle,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.conversations(variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.byConversation(variables.conversationId),
      });
    },
  });
}
