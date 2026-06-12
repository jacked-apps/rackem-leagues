/**
 * @fileoverview InviteStatusBadge Component
 *
 * Displays a badge indicating the invite status for a placeholder player.
 * Shows different colors and text based on whether the invite is pending or expired.
 *
 * Used in TeamEditorModal to show captains which PPs have been invited.
 *
 * @example
 * <InviteStatusBadge status={inviteStatus} />
 */

import React from 'react';
import { Mail, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { InviteStatus } from '@/api/hooks/useInviteStatuses';

interface InviteStatusBadgeProps {
  /** The invite status object from useInviteStatuses hook */
  status: InviteStatus | null;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Badge showing invite status for placeholder players
 *
 * - Pending invite: Green "Invite Sent" badge with mail icon
 * - Expired invite: Amber "Invite Expired" badge with clock icon
 * - No invite: Returns null (no badge displayed)
 */
export const InviteStatusBadge: React.FC<InviteStatusBadgeProps> = ({
  status,
  className,
}) => {
  if (!status) {
    return null;
  }

  // Claimed invites don't need a badge (PP is now a real user)
  if (status.status === 'claimed') {
    return null;
  }

  // Cancelled invites don't need a badge
  if (status.status === 'cancelled') {
    return null;
  }

  // Expired invite
  if (status.isExpired || status.status === 'expired') {
    return (
      <Badge
        variant="outline"
        className={`bg-warning/10 text-warning border-warning/40 text-[10px] px-1.5 py-0 ${className || ''}`}
      >
        <Clock className="h-3 w-3" />
        Expired
      </Badge>
    );
  }

  // Pending invite
  return (
    <Badge
      variant="outline"
      className={`bg-success/10 text-success border-success/40 text-[10px] px-1.5 py-0 ${className || ''}`}
    >
      <Mail className="h-3 w-3" />
      Invited
    </Badge>
  );
};
