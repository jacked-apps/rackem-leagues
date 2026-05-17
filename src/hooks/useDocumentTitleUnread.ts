/**
 * @fileoverview Browser-tab-title unread-count syncer.
 *
 * Mirrors the iMessage / Slack / Gmail pattern: when you have unread
 * messages, the browser tab title shows the count in parentheses so
 * the user can see at a glance — from another tab — that they have
 * messages waiting. When unread drops to zero, the original title
 * (whatever was rendered in `index.html`) is restored.
 *
 * Mount once near the root (see `<DocumentTitleUnreadSyncer />`).
 * Multiple mounts are harmless but wasteful — the hook polls the
 * unread-count query for its data.
 *
 * Implementation notes:
 *   - `useUnreadMessageCount` is the polling-based hook used in nav
 *     (not the realtime channel one — that's reserved for the
 *     Messages page). So unread visible in the tab title may lag by
 *     up to one poll interval, but it doesn't open an extra channel.
 *   - We capture the original `document.title` on first mount so we
 *     can restore it cleanly when unread goes back to zero. Some
 *     pages may set their own per-route titles in the future; this
 *     hook treats the captured baseline as the canonical "no unread"
 *     title until the component unmounts.
 */

import { useEffect, useRef } from 'react';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useUnreadMessageCount } from '@/api/hooks/useMessages';

export function useDocumentTitleUnread(): void {
  const { data: member } = useCurrentMember();
  const { data: unreadCount = 0 } = useUnreadMessageCount(member?.id);

  // Capture the baseline title once, on first effect run. Stored in a
  // ref so it survives subsequent renders without re-capturing the
  // already-prefixed value (which would compound on every poll).
  const baselineTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (baselineTitleRef.current === null) {
      baselineTitleRef.current = document.title;
    }
    const baseline = baselineTitleRef.current;
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseline}` : baseline;
  }, [unreadCount]);

  // Restore the baseline title on unmount so the count doesn't get
  // stuck if this hook is ever dismounted (e.g., during dev HMR).
  useEffect(() => {
    return () => {
      if (baselineTitleRef.current !== null) {
        document.title = baselineTitleRef.current;
      }
    };
  }, []);
}

/**
 * Mount-only component that calls `useDocumentTitleUnread`. Mount
 * near the root, inside `UserProvider` (so the hook can resolve the
 * current user) but outside the routes (so the hook doesn't re-mount
 * on every navigation).
 */
export function DocumentTitleUnreadSyncer(): null {
  useDocumentTitleUnread();
  return null;
}
