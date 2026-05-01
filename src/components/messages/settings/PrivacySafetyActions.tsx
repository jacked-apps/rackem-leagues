/**
 * @fileoverview Privacy & Safety Actions Component
 *
 * Action buttons for privacy and safety features:
 * - Blocked users management
 * - My reports (coming soon)
 */

import { UserX, Flag, ChevronRight } from 'lucide-react';

interface PrivacySafetyActionsProps {
  onBlockedUsersClick: () => void;
}

export function PrivacySafetyActions({ onBlockedUsersClick }: PrivacySafetyActionsProps) {
  return (
    <div className="border-t pt-4 space-y-2">
      {/* Blocked Users */}
      <button
        onClick={onBlockedUsersClick}
        className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-md transition-colors text-left group"
      >
        <div className="flex items-center gap-3">
          <UserX className="h-4 w-4 text-muted-foreground group-hover:text-muted-foreground" />
          <div>
            <div className="text-sm font-medium text-foreground">Blocked Users</div>
            <div className="text-xs text-muted-foreground">Manage blocked users list</div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* My Reports */}
      <button className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-md transition-colors text-left group">
        <div className="flex items-center gap-3">
          <Flag className="h-4 w-4 text-muted-foreground group-hover:text-muted-foreground" />
          <div>
            <div className="text-sm font-medium text-foreground">My Reports</div>
            <div className="text-xs text-muted-foreground">View reports you've submitted</div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
