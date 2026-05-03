/**
 * @fileoverview Conversation List Item Component
 *
 * Individual conversation item in the list.
 * Shows title, last message preview, timestamp, and unread count.
 * Mobile-optimized with larger touch targets.
 */

import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ConversationItemProps {
  id: string;
  title: string | null;
  conversationType: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationItem({
  title,
  conversationType,
  lastMessageAt,
  lastMessagePreview,
  unreadCount,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const isAnnouncement = conversationType === 'announcements';
  const displayTitle = title || 'Direct Message';

  const formatTimestamp = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        // Mobile-first: Larger touch targets with responsive padding
        'w-full p-4 md:p-3 text-left border-b border-border hover:bg-muted active:bg-accent transition-colors',
        // Min height for touch targets (60px on mobile, 56px on desktop)
        'min-h-[60px] md:min-h-[56px]',
        isSelected && 'bg-blue-50 hover:bg-blue-100'
      )}
    >
      <div className="flex items-start justify-between mb-1.5 md:mb-1">
        <span className="font-semibold text-sm md:text-base flex items-center gap-2">
          {displayTitle}
          {isAnnouncement && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              Announcement
            </span>
          )}
        </span>
        <span className="text-xs md:text-xs text-muted-foreground flex-shrink-0 ml-2">
          {formatTimestamp(lastMessageAt)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm md:text-sm text-muted-foreground truncate flex-1">
          {lastMessagePreview || 'No messages yet'}
        </p>
        {unreadCount > 0 && (
          <span className="ml-2 bg-blue-600 text-white text-xs font-medium rounded-full h-6 w-6 md:h-5 md:w-5 flex items-center justify-center flex-shrink-0">
            {unreadCount}
          </span>
        )}
      </div>
    </button>
  );
}
