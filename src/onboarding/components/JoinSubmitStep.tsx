/**
 * @fileoverview The "ask to join" step for a signed-in, registered member.
 *
 * Shown once the joiner is signed in AND has a profile. If the captain pre-made
 * placeholder spots, we show them as "is one of these you?" claim buttons
 * (Replace path); there's always a "None of these — add me" self-add (the
 * cold-start spine). Submitting files a pending request; on success the hook
 * invalidates the join view and the page flips to the waiting state. Guard
 * outcomes (full / spot just taken / already on team) surface inline.
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

/** Inline copy for the outcomes that don't advance the page on their own. */
const REASON_MESSAGE: Partial<Record<JoinRequestReason, string>> = {
  full: "This team's roster is full — ask the captain to make room, then try again.",
  spot_taken: 'Someone just claimed that spot. Pick another, or add yourself as new.',
  invalid_claim: "That spot isn't available to claim.",
  already_member: "You're already on this team.",
  already_approved: "You're already approved — head to your team.",
  invalid_token: 'This join link is no longer valid.',
};

export const JoinSubmitStep: React.FC<JoinSubmitStepProps> = ({ token, view }) => {
  const submit = useSubmitJoinRequest(token);
  const [error, setError] = useState('');

  const openSpots = view.spots.filter((s) => s.is_open);

  // A submit either advances the page (ok → view refetch flips to "waiting")
  // or comes back with a guard reason we show inline.
  const ask = (claimedMemberId?: string | null) => {
    setError('');
    submit.mutate(claimedMemberId, {
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
        {openSpots.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Are you one of these players? Tap your name to claim your spot.
            </p>
            {openSpots.map((spot) => (
              <Button
                key={spot.member_id}
                variant="outline"
                className="w-full justify-start"
                disabled={submit.isPending}
                onClick={() => ask(spot.member_id)}
              >
                {spot.display_name}
              </Button>
            ))}
          </div>
        )}

        <Button
          className="w-full"
          loadingText="Sending..."
          isLoading={submit.isPending}
          disabled={submit.isPending}
          onClick={() => ask(null)}
        >
          {openSpots.length > 0 ? "None of these — I'm new, add me" : 'Ask to join this team'}
        </Button>

        {error && <p className="text-sm text-center text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
};
