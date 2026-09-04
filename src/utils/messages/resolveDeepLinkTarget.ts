/**
 * @fileoverview Pure resolver for the `/messages/:conversationId` deep link.
 *
 * Unit 3 of the message push-notification feature makes a single conversation
 * openable by URL so a tapped push notification can land on the right thread —
 * even on a cold app load (the old flow used ephemeral router state, which does
 * not survive a fresh navigation).
 *
 * This helper isolates the decision so it can be unit-tested without mounting
 * the whole Messages page: given the URL param and the user's own conversation
 * list, decide which conversation (if any) to open. An unknown/forbidden id
 * falls back to the conversation list rather than opening an empty thread.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 3)
 */

export interface DeepLinkResolution {
  /** The conversation to open, or `null` to fall back to the list. */
  conversationId: string | null;
  /**
   * - `none`     — no deep-link param present; leave any in-app selection alone.
   * - `pending`  — param present but the conversation list hasn't loaded yet;
   *                open it optimistically (validity is re-judged once loaded).
   * - `open`     — param is a conversation the user belongs to.
   * - `notfound` — param is unknown/forbidden; fall back to the list.
   */
  status: 'none' | 'pending' | 'open' | 'notfound';
}

/**
 * Resolve which conversation a `/messages/:conversationId` URL should open.
 *
 * @param params.routeConversationId - the `:conversationId` route param, if any
 * @param params.conversationIds - ids of the current user's conversations
 * @param params.isLoading - whether the conversation list is still loading
 */
export function resolveDeepLinkTarget(params: {
  routeConversationId?: string | null;
  conversationIds: string[];
  isLoading: boolean;
}): DeepLinkResolution {
  const { routeConversationId, conversationIds, isLoading } = params;

  // No deep link → do not touch the current in-app selection.
  if (!routeConversationId) {
    return { conversationId: null, status: 'none' };
  }

  // List not loaded yet → open optimistically so tap-to-open feels instant;
  // the effect re-runs and re-validates once the list arrives.
  if (isLoading) {
    return { conversationId: routeConversationId, status: 'pending' };
  }

  // Loaded: only open ids the user actually belongs to; else fall back to list.
  if (conversationIds.includes(routeConversationId)) {
    return { conversationId: routeConversationId, status: 'open' };
  }
  return { conversationId: null, status: 'notfound' };
}
