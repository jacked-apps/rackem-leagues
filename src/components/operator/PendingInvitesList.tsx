/**
 * @fileoverview PendingInvitesList Component
 *
 * Displays a collapsible list of pending placeholder player invites.
 * Used in PlayerManagement to show operators which invites are pending
 * and allow them to cancel invites.
 *
 * Features:
 * - Toggle to show/hide the list
 * - Shows player name, email, inviting team, and dates
 * - "Remove Invite" button to cancel pending invites
 *
 * @example
 * <PendingInvitesList
 *   invites={pendingInvites}
 *   onCancelInvite={cancelInvite}
 *   isCancelling={isCancelling}
 * />
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { OrganizationInvite } from '@/api/hooks/useOrganizationInvites';

interface PendingInvitesListProps {
  /** List of pending invites to display */
  invites: OrganizationInvite[];
  /** Callback when cancel button is clicked */
  onCancelInvite: (inviteId: string) => void;
  /** Whether a cancel operation is in progress */
  isCancelling: boolean;
}

/**
 * Format a date for display in the invite list
 */
function formatInviteDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

/**
 * Single invite item in the list
 */
const InviteItem: React.FC<{
  invite: OrganizationInvite;
  onCancel: () => void;
  isCancelling: boolean;
}> = ({ invite, onCancel, isCancelling }) => (
  <div className="p-3 bg-muted rounded-md border border-border">
    <div className="flex justify-between items-start">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">
          {invite.member_first_name} {invite.member_last_name}
        </p>
        <p className="text-sm text-muted-foreground">{invite.email}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Invited by: {invite.team_name}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="text-right text-xs text-muted-foreground">
          <p>Sent {formatInviteDate(invite.created_at)}</p>
          {invite.expires_at && (
            <p>Expires {formatInviteDate(invite.expires_at)}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isCancelling}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/40"
        >
          Remove Invite
        </Button>
      </div>
    </div>
  </div>
);

/**
 * PendingInvitesList Component
 *
 * Collapsible list showing pending invites with cancel functionality.
 */
export const PendingInvitesList: React.FC<PendingInvitesListProps> = ({
  invites,
  onCancelInvite,
  isCancelling,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending invites</p>;
  }

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center gap-2"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-4 w-4" />
            Hide Pending Invites
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            Show Pending Invites ({invites.length})
          </>
        )}
      </Button>

      {isExpanded && (
        <div className="space-y-2">
          {invites.map((invite) => (
            <InviteItem
              key={invite.id}
              invite={invite}
              onCancel={() => onCancelInvite(invite.id)}
              isCancelling={isCancelling}
            />
          ))}
        </div>
      )}
    </div>
  );
};
