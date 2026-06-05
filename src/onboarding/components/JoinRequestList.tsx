/**
 * @fileoverview The approve surface — one component, two scopes.
 *
 * Renders the caller's pending join requests (a captain sees his team; an LO
 * sees every team in his org — the scope is decided entirely by the server
 * feed, so this component is identical for both). Each row shows person + team
 * + league and the one-tap decision: Add / Replace / Decline.
 *
 * - Replace opens the record-flagged PlaceholderPicker (only offered when the
 *   team has unclaimed placeholders).
 * - Add asks "are they really new?" ONLY when the team still has unclaimed
 *   placeholders (the strand-a-record guard); otherwise it's one tap.
 * - Decline always confirms.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 5).
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
import { useTeamJoinRequests } from '@/api/hooks/useTeamJoinRequests';
import { useApproveJoinRequest } from '@/api/hooks/useApproveJoinRequest';
import { PlaceholderPicker } from './PlaceholderPicker';
import type { ApproverJoinRequest } from '@/api/queries/teamJoin';

interface JoinRequestListProps {
  /** Optional heading shown above the list when there are requests. */
  title?: string;
  /**
   * When set, an empty feed renders this hint (for a dedicated page). When
   * omitted, an empty feed renders nothing — so the list embeds invisibly in
   * MyTeams / the operator dashboard until someone actually asks to join.
   */
  emptyHint?: string;
}

export const JoinRequestList: React.FC<JoinRequestListProps> = ({ title, emptyHint }) => {
  const { data: requests, isLoading } = useTeamJoinRequests();
  const approve = useApproveJoinRequest();

  const [pickerFor, setPickerFor] = useState<ApproverJoinRequest | null>(null);
  const [confirmAdd, setConfirmAdd] = useState<ApproverJoinRequest | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<ApproverJoinRequest | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const act = (
    req: ApproverJoinRequest,
    action: 'add' | 'replace' | 'decline',
    claimedMemberId?: string | null
  ) => {
    setActingId(req.request_id);
    approve.mutate(
      { requestId: req.request_id, action, claimedMemberId },
      {
        onSettled: () => {
          setActingId(null);
          setPickerFor(null);
          setConfirmAdd(null);
          setConfirmDecline(null);
        },
      }
    );
  };

  // Embedded surfaces stay quiet until there's something to act on.
  if (isLoading) return null;
  if (!requests || requests.length === 0) {
    return emptyHint ? (
      <p className="text-sm text-muted-foreground">{emptyHint}</p>
    ) : null;
  }

  return (
    <div className="space-y-3">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {requests.map((req) => {
        const busy = actingId === req.request_id;
        return (
          <Card key={req.request_id}>
            <CardContent className="pt-6 space-y-3">
              <div>
                <p className="font-semibold">{req.requester_name}</p>
                <p className="text-sm text-muted-foreground">
                  {req.team_name}
                  {req.league_name ? ` · ${req.league_name}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  loadingText="Adding…"
                  isLoading={busy}
                  disabled={busy}
                  onClick={() =>
                    req.has_open_placeholders ? setConfirmAdd(req) : act(req, 'add')
                  }
                >
                  Add
                </Button>
                {req.has_open_placeholders && (
                  <Button variant="outline" disabled={busy} onClick={() => setPickerFor(req)}>
                    Replace
                  </Button>
                )}
                <Button variant="ghost" disabled={busy} onClick={() => setConfirmDecline(req)}>
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Replace → record-flagged picker → merge. */}
      {pickerFor && (
        <PlaceholderPicker
          open={!!pickerFor}
          onOpenChange={(o) => !o && setPickerFor(null)}
          teamId={pickerFor.team_id}
          requesterName={pickerFor.requester_name}
          isPending={actingId === pickerFor.request_id}
          onConfirm={(placeholderId) => act(pickerFor, 'replace', placeholderId)}
        />
      )}

      {/* Add-vs-duplicate guard (only when placeholders still exist). */}
      <AlertDialog open={!!confirmAdd} onOpenChange={(o) => !o && setConfirmAdd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add as a brand-new player?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAdd &&
                `${confirmAdd.requester_name} will join ${confirmAdd.team_name} as a new player. If they already have a record on this team, tap Replace instead to keep their match history.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmAdd && act(confirmAdd, 'add')}>
              Add as new
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline confirm. */}
      <AlertDialog open={!!confirmDecline} onOpenChange={(o) => !o && setConfirmDecline(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDecline &&
                `${confirmDecline.requester_name} won't be added to ${confirmDecline.team_name}. They can ask again later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDecline && act(confirmDecline, 'decline')}>
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
