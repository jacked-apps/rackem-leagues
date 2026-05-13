/**
 * @fileoverview Message Input Component
 *
 * Single responsibility: Handle message composition + display the user's
 * own send failures inline (Unit 8). When `onSend` rejects, the message
 * is stashed in a local "failed" list rendered just above the input —
 * each failed bubble shows the original text, the error reason, and a
 * Retry button. The composer is freed to accept a new draft.
 *
 * The composer text is cleared as soon as the send is attempted; the
 * "what if the user has retry-able content" guarantee is provided by
 * the failed-bubble list above the input, not by holding the text in
 * the composer (which would conflict with letting the user type a new
 * message after a failure — see Unit 8 plan edge case).
 */

import React, { useState, useCallback, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { MessageBubble } from './MessageBubble';

interface FailedMessage {
  id: string;
  content: string;
  error: string;
}

interface MessageInputProps {
  /** Sends a message; must reject (throw) on failure so the failed-bubble path triggers. */
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  maxLength?: number;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `failed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return 'Failed to send';
}

export function MessageInput({ onSend, disabled = false, maxLength = 2000 }: MessageInputProps) {
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([]);

  const attemptSend = useCallback(
    async (content: string) => {
      try {
        await onSend(content);
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, error: errorMessage(err) };
      }
    },
    [onSend],
  );

  const handleSendMessage = async () => {
    const trimmed = messageInput.trim();
    if (!trimmed || sending) return;

    // Clear composer immediately — the failed-bubble path is the recovery
    // surface, not the composer (per Unit 8 edge case).
    const content = messageInput;
    setMessageInput('');
    setSending(true);

    const result = await attemptSend(content);
    if (!result.ok) {
      setFailedMessages((prev) => [
        ...prev,
        { id: makeId(), content, error: result.error },
      ]);
    }
    setSending(false);
  };

  const handleRetry = async (failedId: string, content: string) => {
    // Optimistically remove the failed bubble while the retry is in flight;
    // re-add (with a fresh id) only if the retry also fails.
    setFailedMessages((prev) => prev.filter((m) => m.id !== failedId));
    const result = await attemptSend(content);
    if (!result.ok) {
      setFailedMessages((prev) => [
        ...prev,
        { id: makeId(), content, error: result.error },
      ]);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="border-t bg-gray-300 p-3 md:p-4">
      {failedMessages.length > 0 && (
        <div
          className="space-y-2 mb-3"
          data-testid="failed-messages-list"
          role="alert"
          aria-live="polite"
        >
          {failedMessages.map((m) => (
            <MessageBubble
              key={m.id}
              content={m.content}
              createdAt=""
              isEdited={false}
              isCurrentUser
              recipientLastRead={null}
              failed
              errorMessage={m.error}
              onRetry={() => handleRetry(m.id, m.content)}
            />
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Type a message..."
          value={messageInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessageInput(e.target.value)}
          onKeyDown={handleKeyPress}
          className="flex-1 h-11 md:h-10 text-base md:text-sm bg-card"
          disabled={sending || disabled}
          maxLength={maxLength}
        />
        <Button
          loadingText="none"
          onClick={handleSendMessage}
          disabled={!messageInput.trim() || sending || disabled}
          size="lg"
          className="h-11 w-11 md:h-10 md:w-10 p-0 flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="h-5 w-5 md:h-4 md:w-4 text-white" />
        </Button>
      </div>
      <p className="text-xs text-foreground mt-1.5 md:mt-1">
        {messageInput.length}/{maxLength} characters
      </p>
    </div>
  );
}
