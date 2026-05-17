/**
 * @fileoverview Conversation List Component
 *
 * Displays list of conversations with search functionality.
 * Shows conversation preview with last message and timestamp.
 *
 * Mobile-optimized with:
 * - Larger touch targets (min 60px height)
 * - Responsive padding and font sizes
 * - Touch-friendly spacing
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageSquarePlus, Settings, Megaphone, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversations, useConversationsRealtime } from '@/api/hooks';
import { useProfanityFilter } from '@/hooks/useProfanityFilter';
import { censorProfanity } from '@/utils/profanityFilter';
import { formatDistanceToNow } from 'date-fns';
import { LoadingState, EmptyState } from '@/components/shared';

interface Conversation {
  id: string;
  title: string | null;
  conversationType: string | null;
  scopeType: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  /** True when the current user is a past-member of this conversation
   *  (their `conversation_participants.left_at` is non-NULL). Past-member
   *  rows render under an "Archived" group at the bottom of the list,
   *  visually muted; tapping still opens the chat so the user can read
   *  history, but the composer is replaced by the past-member banner
   *  (handled by `useMessageComposerStatus` + `ReadOnlyBanner`). */
  isPastMember?: boolean;
}

interface ConversationListProps {
  userId: string;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewMessage?: () => void;
  onSettings?: () => void;
  onExit?: () => void;
  onAnnouncements?: () => void;
  showAnnouncements?: boolean;
}

export function ConversationList({
  userId,
  selectedConversationId,
  onSelectConversation,
  onNewMessage,
  onSettings,
  onExit,
  onAnnouncements,
  showAnnouncements = false,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Fetch conversations using TanStack Query
  const { data: conversationsData = [], isLoading: loading } = useConversations(userId);
  const conversations = conversationsData as Conversation[];

  // Real-time subscriptions (auto-manages channels and cleanup)
  useConversationsRealtime(userId);

  // R4 (Unit 7): apply the user's profanity filter to the last-message
  // preview snippet. The DB row + unread-count badge stay unaffected —
  // this is a display-only transform. When the filter is off, the
  // preview renders raw.
  const { shouldFilter } = useProfanityFilter();

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) => {
    const title = conv.title || 'Direct Message';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Format timestamp
  const formatTimestamp = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Announcements Button - Only for captains/operators/admins */}
      {showAnnouncements && (
        <div className="px-3 pb-2 pt-0 md:px-4 md:pb-3 bg-gray-300">
          <Button
            onClick={onAnnouncements}
            variant="outline"
            className="w-full bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
          >
            <Megaphone className="h-4 w-4 mr-2" />
            Send Announcement
          </Button>
        </div>
      )}

      {/* Menu Bar */}
      <div className="px-3 pb-3 pt-0 md:px-4 md:pb-4 md:pt-0 border-b bg-gray-300">
        <div className="flex gap-2 justify-around bg-muted rounded-lg p-2 shadow-sm border border-border">
          {/* New Message */}
          <Button
            variant="ghost"
            onClick={onNewMessage}
            className="flex-1 flex flex-col items-center gap-1 h-auto py-2"
            aria-label="New message"
          >
            <MessageSquarePlus className="h-5 w-5" />
            <span className="text-[10px] text-muted-foreground">New</span>
          </Button>

          {/* Search Toggle */}
          <Button
            variant="ghost"
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 h-auto py-2',
              showSearch && 'bg-blue-100 text-blue-600 hover:bg-blue-100'
            )}
            aria-label="Toggle search"
          >
            <Search className="h-5 w-5" />
            <span className="text-[10px] text-muted-foreground">Search</span>
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            onClick={onSettings}
            className="flex-1 flex flex-col items-center gap-1 h-auto py-2"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] text-muted-foreground">Settings</span>
          </Button>
        </div>
      </div>

      {/* Search Bar - Collapsible */}
      {showSearch && (
        <div className="p-3 md:p-4 border-b bg-muted">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="pl-9 md:pl-10 h-10 md:h-11"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Conversation list — split into active + archived (past-member)
          sections per Unit 20. The archived section only renders when the
          user actually has past-member chats, so most users never see it. */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingState message="Loading conversations..." />
        ) : filteredConversations.length === 0 ? (
          // Unit 11: first thing a new user sees on Messages. The copy
          // sells the core value prop ("message anyone, no phone numbers
          // needed") and sets the expectation that team chats will appear
          // automatically once they're rostered — so an empty list isn't
          // a sign of something broken.
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="You can message anyone in your league — no phone number needed. A team chat will show up here automatically once you're added to a roster."
          />
        ) : (
          (() => {
            const activeList = filteredConversations.filter((c) => !c.isPastMember);
            const archivedList = filteredConversations.filter((c) => c.isPastMember);

            const renderRow = (conversation: Conversation) => {
              const isAnnouncement = conversation.conversationType === 'announcements';
              const displayTitle = conversation.title || 'Direct Message';
              const rawPreview = conversation.lastMessagePreview;
              const preview =
                rawPreview && shouldFilter ? censorProfanity(rawPreview) : rawPreview;

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn(
                    'w-full p-4 md:p-3 text-left border-b border-border hover:bg-muted active:bg-accent transition-colors',
                    'min-h-[60px] md:min-h-[56px]',
                    selectedConversationId === conversation.id && 'bg-blue-50 hover:bg-blue-100',
                    // Past-member rows render muted so they read as "history I
                    // can still browse" rather than as live chats.
                    conversation.isPastMember && 'opacity-60',
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
                      {formatTimestamp(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm md:text-sm text-muted-foreground truncate flex-1">
                      {preview || 'No messages yet'}
                    </p>
                    {/* Hide unread badge for past-member rows — the trigger
                        stops incrementing unread_count once left_at is set,
                        so any leftover number is just stale state from
                        before they left. Showing it would be misleading. */}
                    {!conversation.isPastMember && conversation.unreadCount > 0 && (
                      <span className="ml-2 bg-blue-600 text-white text-xs font-medium rounded-full h-6 w-6 md:h-5 md:w-5 flex items-center justify-center flex-shrink-0">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            };

            return (
              <>
                {activeList.map(renderRow)}
                {archivedList.length > 0 && (
                  <>
                    <div className="px-4 py-2 md:py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border">
                      Archived
                    </div>
                    {archivedList.map(renderRow)}
                  </>
                )}
              </>
            );
          })()
        )}
      </div>

      {/* Footer - Exit button (mobile only) */}
      {onExit && (
        <div className="md:hidden border-t bg-gray-300 px-4 py-4 flex justify-end flex-shrink-0">
          <Button loadingText="none" onClick={onExit}>
            Exit to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
