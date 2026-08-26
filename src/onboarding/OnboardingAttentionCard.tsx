/**
 * @fileoverview Combined onboarding "attention" card for the league page.
 *
 * Merges the two operator to-do surfaces — captains that still need their join
 * link, and pending player join requests — into ONE collapsible card that:
 *   - stands out (accent border + count badges, expanded) when there's work, and
 *   - goes quiet (muted, collapsed, "all players onboarded") when there isn't.
 *
 * The captains list is inlined here (it only ever lived on this page). Join
 * requests reuse the shared {@link JoinRequestList}, which is also used on the
 * dashboard + player pages, so its API is untouched.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/operator/SectionCard';
import { useLeagueTeamsForOnboarding } from '@/api/hooks/useTeamJoinDistribution';
import { useTeamJoinRequests } from '@/api/hooks/useTeamJoinRequests';
import { JoinRequestList } from '@/onboarding/components/JoinRequestList';

interface OnboardingAttentionCardProps {
  leagueId: string;
}

const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

export const OnboardingAttentionCard: React.FC<OnboardingAttentionCardProps> = ({ leagueId }) => {
  const { data: teams } = useLeagueTeamsForOnboarding(leagueId);
  const { data: feed } = useTeamJoinRequests();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const onboardTeams = teams ?? [];
  const requests = (feed ?? []).filter((r) => r.league_id === leagueId);
  const onboardCount = onboardTeams.length;
  const requestCount = requests.length;
  const hasWork = onboardCount > 0 || requestCount > 0;

  const copy = (teamId: string, token: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/join/${token}`);
    setCopiedId(teamId);
    // Flash "Copied!" briefly, then revert so the button reads as clickable
    // again (it always is — clicking re-copies). Guard against a later copy of
    // a different team resetting the wrong one.
    window.setTimeout(() => setCopiedId((cur) => (cur === teamId ? null : cur)), 2000);
  };

  return (
    <SectionCard
      title="Onboarding"
      subtitle={hasWork ? undefined : 'All players onboarded — nothing to approve'}
      actions={
        hasWork ? (
          <div className="flex flex-wrap gap-1">
            {onboardCount > 0 && (
              <Badge className="bg-warning/15 text-warning">{onboardCount} to onboard</Badge>
            )}
            {requestCount > 0 && (
              <Badge className="bg-warning/15 text-warning">
                {requestCount} request{requestCount === 1 ? '' : 's'}
              </Badge>
            )}
          </div>
        ) : undefined
      }
      collapsible
      defaultOpen={hasWork}
      className={hasWork ? 'border-warning/60 ring-1 ring-warning/30' : undefined}
    >
      <div className="space-y-4">
        {/* Captains to onboard — always shown (with an empty note) so the
            surface never disappears on the operator. */}
        <div className="space-y-2">
          <div className={SECTION_LABEL}>Captains to onboard</div>
          {onboardCount > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Send each captain their team's join link — they invite their own players and drop
                off this list once they register.
              </p>
              {onboardTeams.map((t) => (
                <div
                  key={t.team_id}
                  className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.team_name}</p>
                    <p className="truncate text-xs text-muted-foreground">Captain: {t.captain_name}</p>
                  </div>
                  <Button
                    variant="outline"
                    loadingText="none"
                    className="shrink-0"
                    onClick={() => copy(t.team_id, t.join_token)}
                  >
                    {copiedId === t.team_id ? 'Copied!' : 'Copy link'}
                  </Button>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">All captains have registered.</p>
          )}
        </div>

        {/* Join requests — always shown; JoinRequestList's emptyHint keeps the
            surface visible when there's nothing pending. */}
        <div className="border-t border-border pt-4">
          <div className={`${SECTION_LABEL} mb-2`}>Join requests</div>
          <JoinRequestList leagueId={leagueId} emptyHint="No pending join requests yet." />
        </div>
      </div>
    </SectionCard>
  );
};
