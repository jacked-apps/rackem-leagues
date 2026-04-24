/**
 * @fileoverview Pending Invites Modal
 *
 * Displays pending placeholder player invites to users after login.
 * Shown automatically when the Dashboard detects unclaimed invites.
 *
 * Features:
 * - Lists all pending invites with team name, captain, PP name
 * - Shows expired invites with "Ask captain to resend" message
 * - "Claim" button for each valid invite (navigates to /claim-player)
 * - Dismissible - users can close and come back later
 *
 * Uses the get_my_pending_invites() PostgreSQL function to fetch invites.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Clock, UserCheck, AlertTriangle } from 'lucide-react';

/** Pending invite data from get_my_pending_invites() */
export interface PendingInvite {
  token: string;
  member_id: string;
  placeholder_first_name: string;
  placeholder_last_name: string;
  team_name: string | null;
  organization_name: string | null;
  organization_owner_name: string | null;
  captain_name: string | null;
  creator_name: string | null;
  placeholder_nickname: string | null;
  game_count: number | null;
  starting_handicap_5v5: number | null;
  invited_at: string;
  expires_at: string;
  is_expired: boolean;
}

interface PendingInvitesModalProps {
  isOpen: boolean;
  onClose: () => void;
  invites: PendingInvite[];
}

/**
 * Modal showing pending invites to the user
 * Allows them to claim invites directly or dismiss to handle later
 */
export const PendingInvitesModal: React.FC<PendingInvitesModalProps> = ({
  isOpen,
  onClose,
  invites,
}) => {
  const navigate = useNavigate();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Separate valid and expired invites
  const validInvites = invites.filter((i) => !i.is_expired);
  const expiredInvites = invites.filter((i) => i.is_expired);

  /**
   * Navigate to claim page for a specific invite
   */
  const handleClaim = (invite: PendingInvite) => {
    setClaimingId(invite.member_id);
    // Navigate to claim page with token
    navigate(`/claim-player?claim=${invite.member_id}&token=${invite.token}`);
    onClose();
  };

  /**
   * Format the invite date for display
   */
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {invites.length === 1 ? 'Team Invite' : 'Team Invites'}
          </DialogTitle>
          <DialogDescription>
            {validInvites.length > 0
              ? "You've been invited to join a team! Claim your player history to get started."
              : 'Your invites have expired. Ask your captain to send new ones.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-80 overflow-y-auto py-2">
          {/* Valid invites */}
          {validInvites.map((invite) => (
            <div
              key={invite.member_id}
              className="border rounded-lg p-3 bg-blue-50 border-blue-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Fixed call-to-action headline so the card's purpose
                      is instantly clear regardless of which fields are
                      populated. Team name gets its own labeled row below. */}
                  <p className="font-medium text-blue-900">
                    You've been invited
                  </p>

                  {/* Team — labeled so users recognize it as a team, not
                      mistake it for a headline. Falls back to "No team yet"
                      for auto-invites without team context. */}
                  <p className="text-sm text-blue-700">
                    <span className="text-blue-600">Team:</span>{' '}
                    <span className="font-medium">
                      {invite.team_name ?? 'No team yet'}
                    </span>
                  </p>

                  {/* Organization */}
                  {invite.organization_name && (
                    <p className="text-sm text-blue-700">
                      <span className="text-blue-600">Organization:</span>{' '}
                      <span className="font-medium">{invite.organization_name}</span>
                    </p>
                  )}

                  {/* Attribution — captain who explicitly invited, else creator. */}
                  {(invite.captain_name || invite.creator_name) && (
                    <p className="text-sm text-blue-700">
                      <span className="text-blue-600">
                        {invite.captain_name ? 'Invited by:' : 'Created by:'}
                      </span>{' '}
                      <span className="font-medium">
                        {invite.captain_name ?? invite.creator_name}
                      </span>
                    </p>
                  )}

                  {/* Profile identity line — name + nickname if set */}
                  <p className="text-xs text-blue-600 pt-0.5">
                    Profile: {invite.placeholder_first_name}
                    {invite.placeholder_nickname
                      ? ` "${invite.placeholder_nickname}"`
                      : ''}{' '}
                    {invite.placeholder_last_name}
                  </p>

                  {/* Stats row — games played + starting handicap. Chips
                      only render when the underlying data is present. */}
                  {(invite.game_count !== null || invite.starting_handicap_5v5 !== null) && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {invite.game_count !== null && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                          {invite.game_count === 0
                            ? 'No games played yet'
                            : `${invite.game_count} game${invite.game_count === 1 ? '' : 's'} played`}
                        </span>
                      )}
                      {invite.starting_handicap_5v5 !== null && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                          Handicap {invite.starting_handicap_5v5}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Org-owner line for trust — "run by X" so the invited
                      user knows whose organization they're joining. */}
                  {invite.organization_owner_name && (
                    <p className="text-xs text-blue-600 pt-0.5 italic">
                      Run by {invite.organization_owner_name}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  loadingText="..."
                  isLoading={claimingId === invite.member_id}
                  onClick={() => handleClaim(invite)}
                >
                  <UserCheck className="h-4 w-4 mr-1" />
                  Accept
                </Button>
              </div>
            </div>
          ))}

          {/* Expired invites */}
          {expiredInvites.length > 0 && (
            <>
              {validInvites.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                    <Clock className="h-4 w-4" />
                    Expired Invites
                  </p>
                </div>
              )}
              {expiredInvites.map((invite) => (
                <div
                  key={invite.member_id}
                  className="border rounded-lg p-3 bg-amber-50 border-amber-200"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-amber-900 truncate">
                        {invite.team_name ?? 'Pending player claim'}
                      </p>
                      <p className="text-sm text-amber-700">
                        Invite expired {formatDate(invite.expires_at)}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Ask{' '}
                        {invite.captain_name ? (
                          <strong>{invite.captain_name}</strong>
                        ) : (
                          'your captain'
                        )}{' '}
                        to send a new invite
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {validInvites.length > 0 ? 'Remind Me Later' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
