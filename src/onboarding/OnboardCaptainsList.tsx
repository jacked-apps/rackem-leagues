/**
 * @fileoverview LO "onboard my captains" list (Unit 7).
 *
 * One row per team in the org — Team · League · assigned captain · Copy link —
 * pre-paired (a team is created with its captain), so the LO hands each captain
 * the RIGHT /join/:token link with no manual matching. The first link in the
 * cascade: the LO seeds captains, each captain self-serves their players.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 7).
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrgTeamsForOnboarding } from '@/api/hooks/useTeamJoinDistribution';

interface OnboardCaptainsListProps {
  orgId: string;
}

export const OnboardCaptainsList: React.FC<OnboardCaptainsListProps> = ({ orgId }) => {
  const { data: teams, isLoading } = useOrgTeamsForOnboarding(orgId);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (isLoading || !teams || teams.length === 0) return null;

  const copy = (teamId: string, token: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/join/${token}`);
    setCopiedId(teamId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboard my captains</CardTitle>
        <p className="text-sm text-muted-foreground">
          Send each captain their team's join link. They'll invite their own players.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {teams.map((t) => (
          <div
            key={t.team_id}
            className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{t.team_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {t.league_name ? `${t.league_name} · ` : ''}Captain: {t.captain_name}
              </p>
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
      </CardContent>
    </Card>
  );
};
