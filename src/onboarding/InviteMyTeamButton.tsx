/**
 * @fileoverview Captain's "Invite my team" control (Unit 7).
 *
 * Shares the team's persistent /join/:token link (the "address") via the
 * existing ShareLinkSection (copy + QR). Includes a "Generate new link" rotate
 * affordance for a leaked link (submitted requests are unaffected — they key on
 * team_id), and a dismissible first-run tip that explains the get-link → share
 * → approve loop. The tip's dismissal is a per-device localStorage flag (a
 * one-time nudge doesn't warrant a members migration).
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 7).
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ShareLinkSection } from '@/components/invite/ShareLinkSection';
import { InfoButton } from '@/components/InfoButton';
import { InviteHelpContent } from './InviteHelpContent';
import {
  useTeamJoinToken,
  useRotateTeamJoinToken,
} from '@/api/hooks/useTeamJoinDistribution';
import { useMemberFirstName } from '@/api/hooks/useCurrentMember';

const TIP_KEY = 'onboarding-invite-tip-dismissed';

/**
 * Build the player-facing invite message a captain pastes into a text/email.
 * Mirrors the real cascade steps (passwordless email sign-in → short profile →
 * "Add me" → captain approves) so the player knows exactly what to expect and
 * isn't staring at a naked URL. Names the captain so the player recognizes who
 * invited them. Kept plain/brand-light intentionally.
 */
const buildJoinShareMessage = (
  captainName: string,
  teamName: string,
  joinUrl: string,
): string => {
  // Fall back to a generic noun when the captain's name hasn't loaded yet.
  const inviter = captainName.trim() || 'Your captain';
  return (
    `${inviter} has invited you to join ${teamName}!\n\n` +
    `Tap this link to get on the roster: ${joinUrl}\n\n` +
    `You'll sign in with your email, fill out a quick profile, and tap "Add me." ` +
    `Then ${inviter} can approve and you're on the team.`
  );
};

interface InviteMyTeamButtonProps {
  teamId: string;
  teamName: string;
}

export const InviteMyTeamButton: React.FC<InviteMyTeamButtonProps> = ({
  teamId,
  teamName,
}) => {
  const { data: token } = useTeamJoinToken(teamId);
  const rotate = useRotateTeamJoinToken(teamId);
  // The captain sharing the link is the current user — name them in the message.
  const captainName = useMemberFirstName();
  const [tipDismissed, setTipDismissed] = useState(
    () => localStorage.getItem(TIP_KEY) === '1'
  );
  const [confirmRotate, setConfirmRotate] = useState(false);

  const dismissTip = () => {
    localStorage.setItem(TIP_KEY, '1');
    setTipDismissed(true);
  };

  const joinUrl = token ? `${window.location.origin}/join/${token}` : '';

  return (
    <div className="space-y-2">
      {!tipDismissed && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="font-medium">Fill your roster the easy way</p>
          <p className="text-muted-foreground">
            Share one link with your players. As each signs up you'll get a request
            to approve — tap Add and they're on the team.
          </p>
          <Button variant="link" loadingText="none" className="px-0 h-auto" onClick={dismissTip}>
            Got it
          </Button>
        </div>
      )}

      <Dialog>
        <div className="flex items-center gap-1">
          <DialogTrigger asChild>
            <Button variant="outline" loadingText="none">
              Invite my team
            </Button>
          </DialogTrigger>
          {/* In-place help: how to share the link + approve players. */}
          <InfoButton title="How to invite your team">
            <InviteHelpContent />
          </InfoButton>
        </div>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite players to {teamName}</DialogTitle>
          </DialogHeader>

          {joinUrl ? (
            <ShareLinkSection
              registrationLink={joinUrl}
              shareMessage={buildJoinShareMessage(captainName, teamName, joinUrl)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Preparing your link…</p>
          )}

          <div className="border-t pt-3">
            {confirmRotate ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Generate a new link? The current link will stop working — only do
                  this if it was shared with the wrong people.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    loadingText="Generating…"
                    isLoading={rotate.isPending}
                    disabled={rotate.isPending}
                    onClick={() => rotate.mutate(undefined, { onSettled: () => setConfirmRotate(false) })}
                  >
                    Generate new link
                  </Button>
                  <Button variant="ghost" loadingText="none" onClick={() => setConfirmRotate(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="link" loadingText="none" className="px-0" onClick={() => setConfirmRotate(true)}>
                Link shared with the wrong people? Generate a new one
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
