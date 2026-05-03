/**
 * @fileoverview Conversation Menu Bar Component
 *
 * Action bar with New Message, Search, and Settings buttons.
 * Mobile-optimized with icon + label layout.
 */

import { Button } from '@/components/ui/button';
import { MessageSquarePlus, Search, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationMenuBarProps {
  showSearch: boolean;
  onNewMessage?: () => void;
  onToggleSearch: () => void;
  onSettings?: () => void;
}

export function ConversationMenuBar({
  showSearch,
  onNewMessage,
  onToggleSearch,
  onSettings,
}: ConversationMenuBarProps) {
  return (
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
          onClick={onToggleSearch}
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
  );
}
