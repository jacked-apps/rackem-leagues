/**
 * @fileoverview The "ask to join" step for a signed-in, registered member.
 *
 * The shared team link is fully generic — one link for everyone, bound to no
 * one. So the joiner doesn't pick a name or claim a spot here; he just asks to
 * join as himself, and the CAPTAIN makes the match (add as new, or connect him
 * to an existing placeholder) at the approve gate. Submitting files a pending
 * request; on success the hook invalidates the join view and the page flips to
 * the waiting state. Guard outcomes (roster full / already on team) surface
 * inline.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubmitJoinRequest } from '@/api/hooks/useSubmitJoinRequest';
import type { TeamJoinView } from '@/api/queries/teamJoin';
import type { JoinRequestReason } from '@/api/mutations/teamJoin';

interface JoinSubmitStepProps {
  token: string;
  view: TeamJoinView;
}

/** Inline copy for the outcomes that don't advance the page on their own. The
 *  generic link never claims a spot, so spot-claim reasons (spot_taken /
 *  invalid_claim) can't occur here. */
const REASON_MESSAGE: Partial<Record<JoinRequestReason, string>> = {
  full: "This team's roster is full — ask the captain to make room, then try again.",
  already_member: "You're already on this team.",
  already_approved: "You're already approved — head to your team.",
  invalid_token: 'This join link is no longer valid.',
};

export const JoinSubmitStep: React.FC<JoinSubmitStepProps> = ({ token, view }) => {
  const submit = useSubmitJoinRequest(token);
  const [error, setError] = useState('');

  // The generic link doesn't carry an identity, so the joiner never claims a
  // placeholder here — he always self-adds (no claimed_member_id) and the
  // captain makes the match at the gate. A submit either advances the page
  // (ok → view refetch flips to "waiting") or returns a guard reason we show
  // inline.
  const ask = () => {
    setError('');
    submit.mutate(null, {
      onSuccess: (result) => {
        if (!result.ok) {
          setError(REASON_MESSAGE[result.reason] ?? 'Could not send your request.');
        }
      },
      onError: () => setError('Something went wrong — please try again.'),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {view.team_name}</CardTitle>
        {view.league_name && (
          <p className="text-sm text-muted-foreground">{view.league_name}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ask to join, and the captain will add you to the team.
        </p>

        <Button
          className="w-full"
          loadingText="Sending..."
          isLoading={submit.isPending}
          disabled={submit.isPending}
          onClick={ask}
        >
          Ask to join this team
        </Button>

        {error && <p className="text-sm text-center text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
};
