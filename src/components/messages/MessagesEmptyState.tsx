/**
 * @fileoverview Messages Empty State Component
 *
 * Single responsibility: Display empty state when no conversation is selected.
 * Reusable component for showing helpful message to user.
 */

import { ConversationHeader } from './ConversationHeader';

export function MessagesEmptyState() {
  return (
    <>
      <ConversationHeader title="No Conversation Selected" />
      <div className="flex-1 flex items-center justify-center text-muted-foreground border-l-[16px] border-r-[16px] border-green-300 overflow-hidden">
        <div className="text-center">
          <p className="text-lg mb-2">No conversation selected</p>
          <p className="text-sm">Choose a conversation or start a new one</p>
        </div>
      </div>
    </>
  );
}
