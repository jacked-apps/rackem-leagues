/**
 * @fileoverview The approve surface — one component, two scopes.
 *
 * Renders the caller's pending join requests (a captain sees his team; an LO
 * sees every team in his org — the scope is decided entirely by the server
 * feed, so this component is identical for both). It owns the approve mutation
 * and the shared lead-in; each request renders as a self-guiding
 * {@link JoinRequestCard} that walks the approver through "is this one of your
 * players?" (link/merge) vs. "just add them" vs. decline.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 5).
 */

import React, { useState } from 'react';
import { useTeamJoinRequests } from '@/api/hooks/useTeamJoinRequests';
import { useApproveJoinRequest } from '@/api/hooks/useApproveJoinRequest';
import { JoinRequestCard } from './JoinRequestCard';
import type { ApproverJoinRequest } from '@/api/queries/teamJoin';

interface JoinRequestListProps {
  /** Optional heading shown above the list (and the empty state, when emptyHint is set). */
  title?: string;
  /**
   * When set, an empty feed renders the title + this hint as a visible section —
   * so an operator can SEE the surface even with nothing pending. When omitted, an
   * empty feed renders nothing (embeds invisibly, e.g. a player's MyTeams page).
   */
  emptyHint?: string;
  /**
   * When set, only requests for this league are shown (the per-league surface).
   * Omit for the org-wide surface (operator dashboard), which shows everything the
   * approver can act on.
   */
  leagueId?: string;
}

export const JoinRequestList: React.FC<JoinRequestListProps> = ({ title, emptyHint, leagueId }) => {
  const { data: feed, isLoading } = useTeamJoinRequests();
  const requests = leagueId ? feed?.filter((r) => r.league_id === leagueId) : feed;
  const approve = useApproveJoinRequest();
  const [actingId, setActingId] = useState<string | null>(null);

  const onApprove = (
    req: ApproverJoinRequest,
    action: 'add' | 'replace' | 'decline',
    claimedMemberId?: string | null,
  ) => {
    setActingId(req.request_id);
    approve.mutate(
      { requestId: req.request_id, action, claimedMemberId },
      { onSettled: () => setActingId(null) },
    );
  };

  // Embedded surfaces stay quiet until there's something to act on. A surface that
  // passes emptyHint stays VISIBLE when empty (title + hint), so an operator can
  // confirm they're looking at the right place.
  if (isLoading) return null;
  if (!requests || requests.length === 0) {
    if (!emptyHint) return null;
    return (
      <div className="space-y-1">
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}

      <p className="text-sm text-muted-foreground">
        These players accepted your invite. Approve each one below.
      </p>

      {requests.map((req) => (
        <JoinRequestCard
          key={req.request_id}
          req={req}
          busy={actingId === req.request_id}
          onApprove={onApprove}
        />
      ))}
    </div>
  );
};
