/**
 * @fileoverview Conversation Header Component
 *
 * Single responsibility: Display conversation title/recipient name.
 * Reusable component for the top of a conversation view.
 *
 * Mobile: Shows back button and conversation title
 * Desktop: Shows only conversation title (back button hidden)
 */

import { ArrowLeft, MoreVertical, LogOut, UserX, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ConversationHeaderProps {
  title: string;
  onBack?: () => void;
  onLeave?: () => void;
  onBlock?: () => void;
  /** Unit 19: rename-chat handler. When provided AND `canRename` is true,
   *  an "Edit name" option appears in the menu. Parent opens its dialog. */
  onRename?: () => void;
  canLeave?: boolean;
  canBlock?: boolean;
  /** Unit 19: enable the "Edit name" menu option. The parent passes this
   *  true only for team chats AND when the current user is the captain
   *  (cannot_leave=true). */
  canRename?: boolean;
}

export function ConversationHeader({
  title,
  onBack,
  onLeave,
  onBlock,
  onRename,
  canLeave = true,
  canBlock = false,
  canRename = false,
}: ConversationHeaderProps) {
  const hasMenu = canLeave || canBlock || canRename;
  return (
    <div className="border-b bg-gray-300 px-3 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3 justify-between">
      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
        {/* Back button - only visible on mobile */}
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="md:hidden -ml-2 flex-shrink-0"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h2 className="text-base md:text-lg font-semibold truncate">{title}</h2>
      </div>

      {/* Options menu */}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canRename && onRename && (
              <DropdownMenuItem onClick={onRename} data-testid="header-rename-item">
                <Pencil className="h-4 w-4 mr-2" />
                Edit name
              </DropdownMenuItem>
            )}
            {canBlock && onBlock && (
              <>
                {canRename && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={onBlock} className="text-orange-600 focus:text-orange-600">
                  <UserX className="h-4 w-4 mr-2" />
                  Block User
                </DropdownMenuItem>
              </>
            )}
            {canLeave && onLeave && (
              <>
                {(canRename || canBlock) && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={onLeave} className="text-red-600 focus:text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Conversation
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
