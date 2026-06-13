/**
 * @fileoverview SetupTeamsPage — the Teams step of the season-setup chain
 * (`/league/:leagueId/season/:seasonId/setup-teams`). Same reusable
 * {@link TeamManagementContent} as the standalone edit page, but with the
 * setup-flow footer: "Save & Exit → league" + "Continue → Playoffs." This is the
 * page the season-setup chain points at, so the standalone edit page can stay
 * free of any "next is playoffs" knowledge.
 *
 * See docs/plans/2026-06-12-001-refactor-teams-standalone-vs-setup-plan.md.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { InfoButton } from '@/components/InfoButton';
import { TeamManagementContent } from './TeamManagementContent';

export const SetupTeamsPage: React.FC = () => {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <div className="min-h-screen bg-muted pb-24">
      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back to League"
        title="Set Up Teams"
        subtitle="Assign venues and create teams, then continue to playoffs"
      >
        <div className="mt-2">
          <InfoButton title="Quick Tip" label="Team Setup Tips">
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                All you have to do is pick a captain for each team. After that, the captain can
                fill in the rest—team name, venue, and players.
              </p>
              <p className="text-sm text-foreground">
                Feel free to add more info if you have it, but it's optional.
              </p>
              <p className="text-sm text-foreground">
                If a team ever wants to change captains, that's something only you can do.
              </p>
            </div>
          </InfoButton>
        </div>
      </PageHeader>

      <TeamManagementContent
        leagueId={leagueId!}
        renderFooter={({ hasTeams }) =>
          hasTeams ? (
            <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-card p-3 shadow-lg">
              <div className="mx-auto grid max-w-4xl grid-cols-2 gap-2">
                <Button
                  className="w-full"
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    setIsNavigating(true);
                    navigate(`/league/${leagueId}`);
                  }}
                  disabled={isNavigating}
                  isLoading={isNavigating}
                  loadingText="Loading..."
                >
                  Save & Exit
                </Button>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    setIsNavigating(true);
                    navigate(`/league/${leagueId}/season/${seasonId}/playoffs-setup`);
                  }}
                  disabled={isNavigating}
                  isLoading={isNavigating}
                  loadingText="Loading..."
                >
                  Continue to Playoffs →
                </Button>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
};

export default SetupTeamsPage;
