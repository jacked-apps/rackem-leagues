/**
 * @fileoverview Hooks for the notification-control settings.
 *
 * Wraps the per-kind defaults and the quiet-hours window in TanStack Query.
 * Writes are optimistic for the same reason the LMS checkbox is: a setting that
 * appears not to have taken gets toggled again, and a notification preference
 * toggled twice in frustration lands back where it started.
 *
 * @see docs/plans/2026-09-04-001-feat-notification-controls-plan.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotificationKindPrefs,
  getPushableKinds,
  getQuietHours,
  type NotificationKindPref,
  type QuietHours,
} from '../queries/notificationPrefs';
import {
  setNotificationKindPref,
  setQuietHours,
  type SetKindPrefParams,
  type SetQuietHoursParams,
} from '../mutations/notificationPrefs';

/** Query keys for the notification settings. */
const keys = {
  pushableKinds: ['notificationPrefs', 'pushableKinds'] as const,
  kindPrefs: (memberId: string) => ['notificationPrefs', 'kinds', memberId] as const,
  quietHours: (memberId: string) => ['notificationPrefs', 'quietHours', memberId] as const,
};

/**
 * Which conversation kinds can push at all (the system phase switch).
 *
 * Settings uses this to decide what to render — offering a default for a
 * channel that can't send would be a control that does nothing.
 */
export function usePushableKinds() {
  return useQuery({
    queryKey: keys.pushableKinds,
    queryFn: getPushableKinds,
    // Operator-level and effectively static within a session.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * A member's per-kind defaults.
 *
 * @param memberId - Whose preferences to read; the query is disabled without one
 */
export function useNotificationKindPrefs(memberId: string | undefined) {
  return useQuery({
    queryKey: keys.kindPrefs(memberId ?? ''),
    queryFn: () => getNotificationKindPrefs(memberId!),
    enabled: !!memberId,
  });
}

/**
 * A member's quiet-hours window.
 *
 * @param memberId - Whose window to read; the query is disabled without one
 */
export function useQuietHours(memberId: string | undefined) {
  return useQuery({
    queryKey: keys.quietHours(memberId ?? ''),
    queryFn: () => getQuietHours(memberId!),
    enabled: !!memberId,
  });
}

/**
 * Save a per-kind default, optimistically.
 *
 * @returns TanStack mutation taking {@link SetKindPrefParams}
 */
export function useSetNotificationKindPref() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setNotificationKindPref,

    onMutate: async (vars: SetKindPrefParams) => {
      const key = keys.kindPrefs(vars.memberId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationKindPref[]>(key);

      queryClient.setQueryData<NotificationKindPref[]>(key, (old) => {
        const next: NotificationKindPref = {
          conversationKind: vars.conversationKind,
          pushEnabled: vars.pushEnabled,
          intervalMinutes: vars.intervalMinutes,
        };
        const rest = (old ?? []).filter(
          (p) => p.conversationKind !== vars.conversationKind
        );
        return [...rest, next];
      });

      return { previous, key };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },

    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: keys.kindPrefs(vars.memberId) });
    },
  });
}

/**
 * Save the quiet-hours window, optimistically.
 *
 * @returns TanStack mutation taking {@link SetQuietHoursParams}
 */
export function useSetQuietHours() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setQuietHours,

    onMutate: async (vars: SetQuietHoursParams) => {
      const key = keys.quietHours(vars.memberId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<QuietHours>(key);

      queryClient.setQueryData<QuietHours>(key, {
        start: vars.start,
        end: vars.end,
        timezone: vars.timezone,
      });

      return { previous, key };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },

    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: keys.quietHours(vars.memberId) });
    },
  });
}
