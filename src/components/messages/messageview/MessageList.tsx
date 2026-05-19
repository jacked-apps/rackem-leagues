/**
 * @fileoverview Message List Component
 *
 * Scrollable rendering of confirmed messages from the server, with the
 * Unit 8 inline-failed-send pattern layered on top: optimistic
 * outgoing messages (sending / failed) render at the bottom of the
 * thread, where the user expects "what I just sent" to appear.
 *
 * Three message kinds rendered here:
 *   - System messages (`is_system=true`, sender NULL) — centered,
 *     italic, muted (Unit 7 variant).
 *   - Regular messages — default bubble variant.
 *   - Outgoing messages — locally-tracked optimistic sends. Pending
 *     ones render like the user's own normal bubble. Failed ones use
 *     the destructive failed variant with a Retry button (Unit 8).
 *
 * Auto-scrolls to bottom whenever either the confirmed list or the
 * outgoing list changes (new sends should bring the bottom into view).
 */

import { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { LoadingState, EmptyState } from '@/components/shared';
import { MessageBubble } from '../MessageBubble';
import type { OutgoingMessage } from './useOutgoingMessages';

export interface Message {
  id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  is_edited: boolean;
  is_system: boolean;
  // Null for system messages (sender_id IS NULL by CHECK constraint).
  sender: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: number;
  } | null;
}

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  recipientLastRead: string | null;
  loading: boolean;
  /** Unit 8 inline-failed-send: locally-tracked sends, rendered after `messages`. */
  outgoingMessages?: OutgoingMessage[];
  /** Click handler for the Retry button on a failed outgoing message. */
  onRetryOutgoing?: (clientId: string, content: string) => void;
}

export function MessageList({
  messages,
  currentUserId,
  recipientLastRead,
  loading,
  outgoingMessages = [],
  onRetryOutgoing,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever either confirmed or outgoing changes — a
  // new optimistic send should be visible immediately.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, outgoingMessages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState message="Loading messages..." />
      </div>
    );
  }

  if (messages.length === 0 && outgoingMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="Start the conversation!"
        />
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => {
        // System messages (sender_id IS NULL by CHECK constraint) render
        // in a distinct centered/italic variant; no sender → no avatar,
        // no read receipt, no isCurrentUser concept.
        if (message.is_system) {
          return (
            <MessageBubble
              key={message.id}
              content={message.content}
              createdAt={message.created_at}
              isEdited={message.is_edited}
              isCurrentUser={false}
              isSystem
              recipientLastRead={null}
            />
          );
        }

        // Non-system messages with a missing sender row would be a data
        // bug (CHECK constraint violation); skip rather than crash.
        if (!message.sender) {
          return null;
        }

        const isCurrentUser = message.sender.id === currentUserId;
        const senderName = `${message.sender.first_name} ${message.sender.last_name}`;

        return (
          <MessageBubble
            key={message.id}
            content={message.content}
            createdAt={message.created_at}
            isEdited={message.is_edited}
            isCurrentUser={isCurrentUser}
            senderName={!isCurrentUser ? senderName : undefined}
            senderId={!isCurrentUser ? message.sender.id : undefined}
            recipientLastRead={recipientLastRead}
          />
        );
      })}

      {/* Outgoing (Unit 8): optimistic sends after the confirmed list.
          Pending = looks like a normal sender-side bubble; failed = the
          destructive variant with inline error + Retry. */}
      {outgoingMessages.map((out) => {
        if (out.status === 'failed') {
          return (
            <MessageBubble
              key={out.clientId}
              content={out.content}
              createdAt={out.createdAt}
              isEdited={false}
              isCurrentUser
              recipientLastRead={null}
              failed
              errorMessage={out.errorMessage}
              onRetry={
                onRetryOutgoing
                  ? () => onRetryOutgoing(out.clientId, out.content)
                  : undefined
              }
            />
          );
        }

        // Pending — render as the user's normal sent bubble. No read
        // receipt yet (server hasn't acknowledged), and no edit state.
        return (
          <MessageBubble
            key={out.clientId}
            content={out.content}
            createdAt={out.createdAt}
            isEdited={false}
            isCurrentUser
            recipientLastRead={null}
          />
        );
      })}
      <div ref={messagesEndRef} />
    </>
  );
}
