/**
 * @fileoverview Message Input Component
 *
 * Single responsibility: handle message composition + dispatch send.
 *
 * `onSend` is expected to handle its own failure reporting — the failed-
 * send recovery UX (Unit 8) is rendered inline in the conversation
 * thread by `MessageList`, NOT in this composer. This component clears
 * its text on submit regardless of outcome; the failed message lives in
 * `useOutgoingMessages` (consumed by `MessageView`).
 *
 * Mobile-optimized:
 * - Larger send button for touch targets
 * - Responsive padding and sizing
 * - Mobile-friendly character counter
 */

import React, { useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { EmojiPickerButton } from './EmojiPickerButton';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  maxLength?: number;
}

export function MessageInput({ onSend, disabled = false, maxLength = 2000 }: MessageInputProps) {
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Insert an emoji at the current cursor position (or append if focus
  // hasn't been on the input yet). Keeps focus on the input afterward so
  // the user can keep typing or send immediately.
  const handlePickEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) {
      setMessageInput((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? messageInput.length;
    const end = el.selectionEnd ?? messageInput.length;
    const next = messageInput.slice(0, start) + emoji + messageInput.slice(end);
    setMessageInput(next);
    // Restore cursor just past the inserted emoji on the next tick so
    // React has applied the new value.
    queueMicrotask(() => {
      el.focus();
      const cursor = start + emoji.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || sending) return;

    const content = messageInput;
    // Clear immediately — the in-list optimistic bubble takes over the
    // job of "showing what was just sent" (and, on failure, becoming the
    // retryable failed bubble).
    setMessageInput('');
    setSending(true);
    try {
      // onSend swallows its own errors (MessageView marks the optimistic
      // outgoing entry as failed). We don't need to catch here.
      await onSend(content);
    } finally {
      setSending(false);
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
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          value={messageInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessageInput(e.target.value)}
          onKeyDown={handleKeyPress}
          className="flex-1 h-11 md:h-10 text-base md:text-sm bg-card"
          disabled={sending || disabled}
          maxLength={maxLength}
        />
        <EmojiPickerButton onPick={handlePickEmoji} disabled={sending || disabled} />
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
