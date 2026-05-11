/**
 * @fileoverview Message Bubble Component
 *
 * Single responsibility: Display a single message with read receipts.
 * Reusable component for rendering individual messages in a conversation.
 *
 * Profanity Filtering:
 * - Applies display-time filtering based on viewer's profanity filter setting
 * - Users under 18 always see filtered content (forced ON)
 * - Users 18+ see filtered content only if they have filter enabled
 * - Original message content stored uncensored in database
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
}

export function MessageBubble({
  content,
  createdAt,
  isEdited,
  isCurrentUser,
  senderName,
  senderId,
  recipientLastRead,
}: MessageBubbleProps) {
  // Get user's profanity filter setting (forced ON for under 18, optional for 18+)
  const { shouldFilter } = useProfanityFilter();

  // Apply profanity filter if user has it enabled (or is under 18)
  const displayContent = shouldFilter ? censorProfanity(content) : content;

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
