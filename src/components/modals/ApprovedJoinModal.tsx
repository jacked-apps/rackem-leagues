/**
 * @fileoverview "You're in!" popup for an approved join request.
 *
 * Sibling of PendingInvitesModal: mounted app-wide so a joiner who closed the
 * tab (or switched devices) learns the moment a captain/LO approves them, and
 * is routed to their team. Acknowledging stamps the request so it shows once.
 * Handles one at a time — the next (if any) surfaces on the following poll.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { ApprovedJoinRequest } from '@/api/queries/teamJoin';

interface ApprovedJoinModalProps {
  /** The approved join to celebrate, or null when there's nothing to show. */
  request: ApprovedJoinRequest | null;
  /** Acknowledge (stamp) the request so it won't reappear. */
  onAcknowledge: (requestId: string) => void;
}

export const ApprovedJoinModal: React.FC<ApprovedJoinModalProps> = ({
  request,
  onAcknowledge,
}) => {
  const navigate = useNavigate();
  if (!request) return null;

  const goToTeam = () => {
    onAcknowledge(request.request_id);
    navigate('/my-teams');
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onAcknowledge(request.request_id)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You're on the team! 🎉</DialogTitle>
          <DialogDescription>
            You've been added to {request.team_name}
            {request.league_name ? ` (${request.league_name})` : ''}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button loadingText="none" onClick={goToTeam}>
            Go to my team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
