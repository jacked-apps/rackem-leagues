/**
 * @fileoverview Message Bubble Component
 *
 * Single responsibility: Display a single message with read receipts.
 * Reusable component for rendering individual messages in a conversation.
 *
 * Two render variants:
 *  - Default bubble (user-to-user): colored bubble, sender link, timestamp,
 *    read receipt.
 *  - System bubble (trigger-driven "Sally joined the team" lines, marked
 *    `is_system = true` and `sender_id IS NULL` per the messages_is_system_shape
 *    CHECK constraint): centered, italic, muted-foreground; no avatar, no
 *    sender link, no timestamp, no read receipt.
 *
 * Profanity Filtering:
 * - Applies display-time filtering based on viewer's profanity filter setting
 *   (see `useProfanityFilter`).
 * - Filter is forced ON when the viewer's `members.date_of_birth` is on file
 *   AND `isMinor()` is true — DOB is optional, so when it's unknown the
 *   filter falls back to the viewer's stored preference.
 * - Original message content stored uncensored in DB; transform is render-only.
 * - System messages also pass through the filter (defensive — covers cases
 *   like a player whose name itself contains profanity in a "X joined the
 *   team" notification).
 */

import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { PlayerNameLink } from '@/components/PlayerNameLink';
import { useProfanityFilter } from '@/hooks/useProfanityFilter';
import { censorProfanity } from '@/utils/profanityFilter';

interface MessageBubbleProps {
  content: string;
  createdAt: string;
  isEdited: boolean;
  isCurrentUser: boolean;
  senderName?: string;
  senderId?: string;
  recipientLastRead: string | null;
  /** When true, renders the centered/italic/muted system-message variant. */
  isSystem?: boolean;
}

export function MessageBubble({
  content,
  createdAt,
  isEdited,
  isCurrentUser,
  senderName,
  senderId,
  recipientLastRead,
  isSystem = false,
}: MessageBubbleProps) {
  const { shouldFilter } = useProfanityFilter();
  const displayContent = shouldFilter ? censorProfanity(content) : content;

  if (isSystem) {
    return (
      <div
        data-testid="system-message"
        className="flex justify-center my-2"
      >
        <p className="text-sm italic text-muted-foreground text-center max-w-md px-4 whitespace-pre-wrap">
          {displayContent}
        </p>
      </div>
    );
  }

  const formatTimestamp = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const isRead = recipientLastRead && new Date(createdAt) <= new Date(recipientLastRead);

  return (
    <div className={cn('flex', isCurrentUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-md rounded-lg px-4 py-2',
          isCurrentUser ? 'bg-blue-600 text-white' : 'bg-accent text-foreground'
        )}
      >
        {!isCurrentUser && senderName && senderId && (
          <div className="text-xs font-semibold mb-1">
            <PlayerNameLink playerId={senderId} playerName={senderName} className="text-foreground hover:text-blue-600" />
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
        <div className="flex items-center gap-1 mt-1">
          <p className={cn('text-xs', isCurrentUser ? 'text-blue-100' : 'text-muted-foreground')}>
            {formatTimestamp(createdAt)}
            {isEdited && ' (edited)'}
          </p>
          {isCurrentUser && recipientLastRead && (
            <span className="text-blue-100">
              {isRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
