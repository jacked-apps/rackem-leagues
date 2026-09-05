/**
 * @fileoverview The per-conversation notification setting — the bottom level of
 * the veto chain.
 *
 * A chat can only ever add silence. It cannot make itself louder than the
 * member's per-kind default, their master switch, or their quiet hours allow.
 * `isOverruled` exists so the UI can SAY that instead of accepting a change
 * that quietly does nothing.
 *
 * @see docs/plans/2026-09-04-001-feat-notification-controls-plan.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

/** This member's setting for one conversation. */
export interface ConversationNotificationPref {
  /** 'all' = adds no restriction; 'none' = this chat is muted. */
  notificationMode: string;
  /** Extra minutes of quiet, or null to defer to the kind default. */
  intervalMinutes: number | null;
}

const key = (conversationId: string, memberId: string) =>
  ['conversationNotificationPref', conversationId, memberId] as const;

/**
 * Read this member's setting for one conversation.
 *
 * @param conversationId - The conversation
 * @param memberId - The member; the query is disabled without both
 */
export function useConversationNotificationPref(
  conversationId: string | undefined,
  memberId: string | undefined
) {
  return useQuery({
    queryKey: key(conversationId ?? '', memberId ?? ''),
    queryFn: async (): Promise<ConversationNotificationPref> => {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('notification_mode, notification_interval_minutes')
        .eq('conversation_id', conversationId!)
        .eq('user_id', memberId!)
        .single();

      if (error) {
        throw new Error(`Failed to fetch chat notification setting: ${error.message}`);
      }
      return {
        notificationMode: (data?.notification_mode as string) ?? 'all',
        intervalMinutes: (data?.notification_interval_minutes as number | null) ?? null,
      };
    },
    enabled: !!conversationId && !!memberId,
  });
}

/** Parameters for {@link useSetConversationNotificationPref}. */
export interface SetConversationPrefParams {
  conversationId: string;
  memberId: string;
  /** true = this chat adds no restriction; false = muted. */
  notify: boolean;
  /** Extra quiet minutes, or null to defer to the kind default. */
  intervalMinutes: number | null;
}

/**
 * Save this member's setting for one conversation, optimistically.
 *
 * @returns TanStack mutation taking {@link SetConversationPrefParams}
 */
export function useSetConversationNotificationPref() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      memberId,
      notify,
      intervalMinutes,
    }: SetConversationPrefParams) => {
      const { error } = await supabase
        .from('conversation_participants')
        .update({
          notification_mode: notify ? 'all' : 'none',
          notification_interval_minutes: intervalMinutes,
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', memberId);

      if (error) {
        throw new Error(`Failed to save chat notification setting: ${error.message}`);
      }
    },

    onMutate: async (vars) => {
      const k = key(vars.conversationId, vars.memberId);
      await queryClient.cancelQueries({ queryKey: k });
      const previous = queryClient.getQueryData<ConversationNotificationPref>(k);

      queryClient.setQueryData<ConversationNotificationPref>(k, {
        notificationMode: vars.notify ? 'all' : 'none',
        intervalMinutes: vars.intervalMinutes,
      });

      return { previous, k };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.k, context.previous);
    },

    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({
        queryKey: key(vars.conversationId, vars.memberId),
      });
      // The conversation list shows a muted marker, so it has to re-read too.
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
