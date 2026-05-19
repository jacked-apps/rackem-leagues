/**
 * @fileoverview useOutgoingMessages hook
 *
 * Local state for messages the current user has just *attempted* to
 * send, but the server hasn't acknowledged yet. Powers Unit 8's
 * inline-failed-send pattern (the one used by iMessage / WhatsApp /
 * Slack / etc): the message appears in the conversation thread
 * immediately as "sending", and either:
 *   - disappears on mutation success (realtime will deliver the
 *     authoritative server-side row to the cache), or
 *   - transitions to status='failed' with an error message that
 *     `MessageBubble` renders as the destructive failed variant with
 *     a Retry button.
 *
 * Each entry is identified by a stable `clientId` so the consuming
 * component can wire retry handlers without re-ordering bubbles on
 * subsequent state changes.
 *
 * The hook does NOT call the server itself — that's the consumer's
 * job. This hook owns the *visualization* of in-flight sends; the
 * consumer owns the *network call*.
 */

import { useCallback, useState } from 'react';

export type OutgoingStatus = 'sending' | 'failed';

export interface OutgoingMessage {
  clientId: string;
  content: string;
  status: OutgoingStatus;
  /** Populated when status === 'failed'. */
  errorMessage?: string;
  /** ISO timestamp of when the optimistic entry was created. Used for ordering. */
  createdAt: string;
}

function makeClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `outgoing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface UseOutgoingMessagesReturn {
  outgoing: OutgoingMessage[];
  /** Add a new outgoing message in `sending` state. Returns the assigned clientId. */
  addPending: (content: string) => string;
  /** Move an existing entry back to `sending` (used on retry). */
  markPending: (clientId: string) => void;
  /** Move an existing entry to `failed` with the given error. */
  markFailed: (clientId: string, errorMessage: string) => void;
  /** Remove an entry (used when the server acknowledges or the user dismisses). */
  remove: (clientId: string) => void;
}

export function useOutgoingMessages(): UseOutgoingMessagesReturn {
  const [outgoing, setOutgoing] = useState<OutgoingMessage[]>([]);

  const addPending = useCallback((content: string): string => {
    const clientId = makeClientId();
    setOutgoing((prev) => [
      ...prev,
      {
        clientId,
        content,
        status: 'sending',
        createdAt: new Date().toISOString(),
      },
    ]);
    return clientId;
  }, []);

  const markPending = useCallback((clientId: string) => {
    setOutgoing((prev) =>
      prev.map((m) =>
        m.clientId === clientId
          ? { ...m, status: 'sending', errorMessage: undefined }
          : m,
      ),
    );
  }, []);

  const markFailed = useCallback((clientId: string, errorMessage: string) => {
    setOutgoing((prev) =>
      prev.map((m) =>
        m.clientId === clientId ? { ...m, status: 'failed', errorMessage } : m,
      ),
    );
  }, []);

  const remove = useCallback((clientId: string) => {
    setOutgoing((prev) => prev.filter((m) => m.clientId !== clientId));
  }, []);

  return { outgoing, addPending, markPending, markFailed, remove };
}
