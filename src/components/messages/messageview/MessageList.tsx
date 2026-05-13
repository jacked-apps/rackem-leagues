/**
 * @fileoverview Message List Component
 *
 * Displays scrollable list of messages with loading and empty states.
 * Auto-scrolls to bottom when new messages arrive.
 */

import { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { LoadingState, EmptyState } from '@/components/shared';
import { MessageBubble } from '../MessageBubble';

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
}

export function MessageList({ messages, currentUserId, recipientLastRead, loading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState message="Loading messages..." />
      </div>
    );
  }

  if (messages.length === 0) {
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
      <div ref={messagesEndRef} />
    </>
  );
}
