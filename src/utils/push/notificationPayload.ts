/**
 * @fileoverview Pure helpers for the push service worker (Unit 4 of message
 * push notifications).
 *
 * The service worker glue (event wiring, `showNotification`, client focus) can't
 * be unit-tested easily, so the *decisions* live here as pure functions: map an
 * incoming push payload to notification content + a tap-to-open target, and
 * decide whether to suppress a notification because the user is already looking
 * at that conversation.
 *
 * The payload contract is the declarative Web Push envelope the dispatcher
 * (Unit 7) sends — `{ web_push: 8030, notification: {...}, data: {...} }` — so one
 * payload serves both iOS (declarative render) and Chrome/Android (this SW's
 * `push` handler reads the same fields).
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 4)
 */

/** Shape the dispatcher sends: declarative Web Push envelope + a data object. */
export interface PushMessagePayload {
  web_push?: number;
  notification?: { title?: string; body?: string; navigate?: string };
  data?: { conversationId?: string };
}

/** Title + options ready to hand to `registration.showNotification`. */
export interface BuiltNotification {
  title: string;
  options: {
    body: string;
    tag: string;
    data: { url: string; conversationId?: string };
  };
}

const DEFAULT_TITLE = 'New message';
const DEFAULT_BODY = 'You have a new message';
const MESSAGES_ROOT = '/messages';

/** The in-app path a tapped notification should open. */
export function deepLinkPath(conversationId?: string | null): string {
  return conversationId ? `${MESSAGES_ROOT}/${conversationId}` : MESSAGES_ROOT;
}

/**
 * Build the OS notification from a raw push payload. Tolerant of malformed or
 * partial input — always returns a showable notification with sensible defaults.
 */
export function buildNotification(raw: unknown): BuiltNotification {
  const payload = (raw && typeof raw === 'object' ? raw : {}) as PushMessagePayload;
  const conversationId = payload.data?.conversationId || undefined;
  const title = payload.notification?.title?.trim() || DEFAULT_TITLE;
  const body = payload.notification?.body?.trim() || DEFAULT_BODY;
  return {
    title,
    options: {
      body,
      // One notification per conversation: collapses rapid-fire messages and
      // prevents the iOS declarative render and this handler from double-showing.
      tag: conversationId ? `conversation:${conversationId}` : 'rackem-message',
      data: { url: deepLinkPath(conversationId), conversationId },
    },
  };
}

/**
 * True if an open window is already viewing this conversation, so the push can
 * be suppressed (don't buzz the chat you're staring at). Best-effort: it only
 * matches the deep-link URL form `/messages/:id`; a conversation opened in-app
 * from the list (URL still `/messages`) is not detected — accepted for v1. iOS
 * declarative push cannot be suppressed here at all.
 */
export function isViewingConversation(
  clientUrl: string,
  conversationId?: string | null
): boolean {
  if (!conversationId) return false;
  let pathname: string;
  try {
    pathname = new URL(clientUrl).pathname;
  } catch {
    return false;
  }
  return pathname === deepLinkPath(conversationId);
}
