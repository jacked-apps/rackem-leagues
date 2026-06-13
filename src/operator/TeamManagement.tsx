/**
 * @fileoverview TeamManagement — the standalone "Manage Teams" page reached from
 * the league dashboard (`/league/:leagueId/manage-teams`). It is now a thin
 * wrapper: page chrome (header + footer) around the reusable
 * {@link TeamManagementContent}. All editing UI + logic lives in the content +
 * its panels/hooks.
 *
 * This is purely an EDIT surface — its only exit is "Done → back to the league".
 * It knows nothing about playoffs or any setup step; the season-setup chain uses
 * its own `SetupTeamsPage` (with "Continue → Playoffs"). See
 * docs/plans/2026-06-12-001-refactor-teams-standalone-vs-setup-plan.md.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { InfoButton } from '@/components/InfoButton';
import { TeamManagementContent } from './TeamManagementContent';

export const TeamManagement: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <div className="min-h-screen bg-muted pb-24">
      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back to League"
        title="Manage Teams"
        subtitle="Assign venues and create teams for your league"
      >
        <div className="mt-2">
          <InfoButton title="Quick Tip" label="Team Management Tips">
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
              <div className="mx-auto flex max-w-4xl justify-end">
                <Button
                  size="lg"
                  onClick={() => {
                    setIsNavigating(true);
                    navigate(`/league/${leagueId}`);
                  }}
                  disabled={isNavigating}
                  isLoading={isNavigating}
                  loadingText="Loading..."
                >
                  Done
                </Button>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
};

export default TeamManagement;
