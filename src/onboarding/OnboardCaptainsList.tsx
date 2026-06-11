/**
 * @fileoverview LO "onboard my captains" list — league-scoped.
 *
 * One row per team in the LEAGUE whose captain has not yet registered —
 * Team · Captain · Copy link. Pre-paired (a team is created with its captain),
 * so the LO hands each captain the RIGHT /join/:token link with no manual
 * matching. The first link in the cascade: the LO seeds captains, each captain
 * self-serves their players.
 *
 * This is a TEMPORARY, self-clearing surface. The underlying RPC returns only
 * teams whose captain is still a placeholder, so a captain drops off the list
 * the moment they register; next season's copied teams already carry registered
 * captains and never appear. When no captains remain, the card renders nothing.
 *
 * See docs/plans/2026-06-06-002-fix-onboard-captains-league-scope-plan.md.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeagueTeamsForOnboarding } from '@/api/hooks/useTeamJoinDistribution';

interface OnboardCaptainsListProps {
  leagueId: string;
}

export const OnboardCaptainsList: React.FC<OnboardCaptainsListProps> = ({ leagueId }) => {
  const { data: teams, isLoading } = useLeagueTeamsForOnboarding(leagueId);
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
          Send each captain their team's join link. They'll invite their own
          players. Captains drop off this list once they register.
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
                Captain: {t.captain_name}
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
