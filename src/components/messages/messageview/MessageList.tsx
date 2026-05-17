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

import { useRef, useEffect, Fragment } from 'react';
import { isNearBottom, findScrollParent } from '@/utils/scrollHelpers';
import { MessageSquare } from 'lucide-react';
import { LoadingState, EmptyState } from '@/components/shared';
import { MessageBubble } from '../MessageBubble';
import { BubbleContextMenu } from './BubbleContextMenu';
import type { OutgoingMessage } from './useOutgoingMessages';
import { interleaveDayDividers } from '@/utils/messageDayDividers';

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
  /** Snapshot of the current user's last_read_at as it was when the
   *  chat was opened. Used to position the "Unread messages" divider
   *  above the first message whose created_at is strictly greater
   *  than this value. NULL = either a brand-new chat or first-ever
   *  open — no divider renders in that case. */
  unreadAnchorAt?: string | null;
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
  unreadAnchorAt = null,
  loading,
  outgoingMessages = [],
  onRetryOutgoing,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Whether the user was near the bottom of the scroll container at
  // the time of the last scroll event. Drives the smart-autoscroll
  // decision: a new incoming message only forces a scroll-to-bottom
  // if the user was already there (i.e., they're tracking the
  // conversation live). If they're scrolled up reading older
  // history, an incoming message must NOT yank them down.
  //
  // Initialized to true so the very first messages render scrolls to
  // bottom (consistent with the pre-smart-scroll behavior on chat
  // open).
  const userNearBottomRef = useRef<boolean>(true);
  // Track previous total row count so we can detect "actually new"
  // arrivals vs. an unrelated re-render (e.g., recipientLastRead
  // changes triggering a re-render with no new content).
  const prevTotalRef = useRef<number>(0);
  // Track the last own-message we scrolled for, so back-to-back
  // sends always force a scroll even if the user happened to have
  // scrolled up between them.
  const prevOwnOutgoingCountRef = useRef<number>(0);

  // Wire a scroll listener once we have a ref to the scroll
  // container (which lives in the parent — we walk up to find it).
  // We re-attach if the parent chain changes (rare; only on remount).
  useEffect(() => {
    const scrollParent = findScrollParent(messagesEndRef.current);
    if (!scrollParent) return;
    const onScroll = () => {
      userNearBottomRef.current = isNearBottom(scrollParent);
    };
    // Seed the value once on mount in case the user never scrolls.
    userNearBottomRef.current = isNearBottom(scrollParent);
    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollParent.removeEventListener('scroll', onScroll);
  }, []);

  // Smart auto-scroll: only force the scroll if either
  //   - the user was at/near the bottom before this render, OR
  //   - the new content is the current user's own send (so the
  //     "what I just sent" expectation is preserved even if they had
  //     just scrolled up to read history before hitting send).
  useEffect(() => {
    const total = messages.length + outgoingMessages.length;
    const ownOutgoingCount = outgoingMessages.length; // every outgoing entry is the user's own
    const isNewMessage = total > prevTotalRef.current;
    const isNewOwnSend = ownOutgoingCount > prevOwnOutgoingCountRef.current;

    if (isNewMessage && (userNearBottomRef.current || isNewOwnSend)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // After scrolling to bottom we ARE at the bottom; update the
      // ref so the next message also scrolls (the scroll event from
      // our own programmatic scroll would update this too, but
      // setting it here is defensive against environments where the
      // listener fires asynchronously).
      userNearBottomRef.current = true;
    }

    prevTotalRef.current = total;
    prevOwnOutgoingCountRef.current = ownOutgoingCount;
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

  // Unit 10: interleave day dividers ("Today" / "Yesterday" / "May 12")
  // between message groups. Pure-function helper; rendered inline below.
  const rows = interleaveDayDividers(messages, (m) => m.created_at);

  // First message id whose created_at is strictly greater than the
  // unread-anchor snapshot. The "Unread messages" divider renders
  // ABOVE this row. Skip the divider entirely when the anchor is
  // null (first-time chat open) or there are no messages newer than
  // the anchor (nothing to mark as unread).
  const firstUnreadId: string | null = (() => {
    if (!unreadAnchorAt) return null;
    const anchorTs = new Date(unreadAnchorAt).getTime();
    for (const m of messages) {
      if (new Date(m.created_at).getTime() > anchorTs) return m.id;
    }
    return null;
  })();

  return (
    <>
      {rows.map((row) => {
        if (row.kind === 'divider') {
          return (
            <div
              key={row.key}
              className="flex items-center gap-3 py-2"
              data-testid="day-divider"
            >
              <div className="flex-1 border-t border-border" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {row.label}
              </span>
              <div className="flex-1 border-t border-border" aria-hidden />
            </div>
          );
        }

        const message = row.message;

        // "Unread messages" divider — renders directly above the
        // first row whose created_at is strictly newer than the
        // snapshot captured at chat-open time. iMessage / WhatsApp /
        // Slack all do something analogous so the user lands at
        // "you left off here" in a busy thread.
        const showUnreadDivider = message.id === firstUnreadId;

        const dividerEl = showUnreadDivider ? (
          <div
            key={`unread-divider-${message.id}`}
            className="flex items-center gap-3 py-2"
            data-testid="unread-divider"
            aria-label="Unread messages below"
          >
            <div className="flex-1 border-t border-blue-500" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Unread messages
            </span>
            <div className="flex-1 border-t border-blue-500" aria-hidden />
          </div>
        ) : null;

        // System messages (sender_id IS NULL by CHECK constraint) render
        // in a distinct centered/italic variant; no sender → no avatar,
        // no read receipt, no isCurrentUser concept.
        if (message.is_system) {
          // System messages don't get the Copy context menu — they
          // narrate events ("Jack joined the team") and copying that
          // doesn't really make sense.
          return (
            <Fragment key={message.id}>
              {dividerEl}
              <MessageBubble
                content={message.content}
                createdAt={message.created_at}
                isEdited={message.is_edited}
                isCurrentUser={false}
                isSystem
                recipientLastRead={null}
              />
            </Fragment>
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
          <Fragment key={message.id}>
            {dividerEl}
            <BubbleContextMenu content={message.content}>
              <MessageBubble
                content={message.content}
                createdAt={message.created_at}
                isEdited={message.is_edited}
                isCurrentUser={isCurrentUser}
                senderName={!isCurrentUser ? senderName : undefined}
                senderId={!isCurrentUser ? message.sender.id : undefined}
                recipientLastRead={recipientLastRead}
              />
            </BubbleContextMenu>
          </Fragment>
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
