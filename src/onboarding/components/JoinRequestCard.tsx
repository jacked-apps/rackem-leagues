/**
 * @fileoverview One join-request card on the approve surface — the guided
 * "who is this?" decision.
 *
 * Reads top to bottom like a question, not a row of buttons:
 *   1. "{name} accepted the invite" — who's asking.
 *   2. If the captain pre-made placeholder spots: "Is this one of your players?"
 *      with each placeholder name as a tap target. Tapping a name links (merges)
 *      the real account into that placeholder so their stats carry over — gated
 *      by a confirm, because a merge transfers a record and can't be undone.
 *   3. "Not one of these — just add them" → a brand-new roster spot.
 *   4. Decline (always confirmed).
 *
 * When the team has no placeholders, the middle question collapses to a single
 * "Add to the team" button. The placeholder list is fetched per-card (each card
 * may be a different team for an LO) and only when placeholders actually exist.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useTeamPlaceholders } from '@/api/hooks/useTeamPlaceholders';
import type {
  ApproverJoinRequest,
  ClaimablePlaceholder,
} from '@/api/queries/teamJoin';

interface JoinRequestCardProps {
  req: ApproverJoinRequest;
  /** True while this card's request is mid-approve (disables its controls). */
  busy: boolean;
  /** Fires the decision. claimedMemberId is the placeholder to merge into. */
  onApprove: (
    req: ApproverJoinRequest,
    action: 'add' | 'replace' | 'decline',
    claimedMemberId?: string | null,
  ) => void;
}

export const JoinRequestCard: React.FC<JoinRequestCardProps> = ({
  req,
  busy,
  onApprove,
}) => {
  // Only fetch placeholders when there are any to claim.
  const { data: placeholders, isLoading } = useTeamPlaceholders(
    req.has_open_placeholders ? req.team_id : undefined,
  );

  // Local confirm state: which placeholder we're about to merge into, and the
  // decline confirmation.
  const [confirmMerge, setConfirmMerge] = useState<ClaimablePlaceholder | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div>
          <p className="font-semibold">{req.requester_name} accepted the invite</p>
          <p className="text-sm text-muted-foreground">
            {req.team_name}
            {req.league_name ? ` · ${req.league_name}` : ''}
          </p>
        </div>

        {req.has_open_placeholders ? (
          <div className="space-y-2">
            <p className="text-sm">
              Is this one of your players? Tap their name to connect them and keep
              their stats.
            </p>

            {isLoading && (
              <p className="text-sm text-muted-foreground">Loading your players…</p>
            )}

            {placeholders?.map((p) => (
              <Button
                key={p.member_id}
                variant="outline"
                className="w-full justify-between"
                disabled={busy}
                onClick={() => setConfirmMerge(p)}
              >
                <span>{p.display_name}</span>
                {p.has_stats && (
                  <span className="text-xs text-muted-foreground">has record</span>
                )}
              </Button>
            ))}

            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => onApprove(req, 'add')}
            >
              Not one of these — just add them to the team
            </Button>
          </div>
        ) : (
          <Button
            loadingText="Adding…"
            isLoading={busy}
            disabled={busy}
            onClick={() => onApprove(req, 'add')}
          >
            Add to the team
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full"
          disabled={busy}
          onClick={() => setConfirmDecline(true)}
        >
          Decline
        </Button>
      </CardContent>

      {/* Tap-a-name confirm — guards against a mis-tap on the list. Copy splits
          on whether the placeholder carries a match record:
          - has a record → it's a real merge (stats move over); ask "same person?"
            and note an operator can unmerge it if it's wrong.
          - no record → nothing to transfer, so it's just adding them to that
            spot — plain "add" language, no merge talk. */}
      <AlertDialog open={!!confirmMerge} onOpenChange={(o) => !o && setConfirmMerge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMerge?.has_stats
                ? 'Are these the same person?'
                : 'Add them to the team?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMerge &&
                (confirmMerge.has_stats
                  ? `Connect ${req.requester_name} to ${confirmMerge.display_name} (has a match record). Their spot and stats move over to ${req.requester_name}. An operator can unmerge it later if it's wrong.`
                  : `Add ${req.requester_name} to ${req.team_name} as ${confirmMerge.display_name}.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmMerge && onApprove(req, 'replace', confirmMerge.member_id)
              }
            >
              {confirmMerge?.has_stats ? 'Yes, same person' : 'Add to team'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline confirm. */}
      <AlertDialog open={confirmDecline} onOpenChange={setConfirmDecline}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {req.requester_name} won't be added to {req.team_name}. They can ask
              again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onApprove(req, 'decline')}>
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
