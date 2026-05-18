/**
 * @fileoverview "Start Next Season" page — the wizard entry point.
 *
 * Hosts the multi-step flow that copies a league's most recent season
 * forward into a new one. Steps live in
 * `src/components/wizard/steps/newSeason/` and are mounted here in
 * order: Dates → Teams → Venues → Schedule → Matchups → Review.
 *
 * Pre-fill data comes from `useNewSeasonPrefill(leagueId)` which
 * bundles previous-season + teams + venues + prefs in a single
 * round-trip. The page is render-only until that query resolves.
 *
 * Route: `/operator/start-next-season/:leagueId`
 * Closes Unit 2 of docs/plans/2026-05-17-001-feat-new-season-from-previous-plan.md.
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNewSeasonPrefill } from '@/api/hooks/useNewSeasonPrefill';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { isNextSeasonRipe } from '@/utils/seasonLifecycle';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { LoadingState, EmptyState } from '@/components/shared';
import { Calendar, AlertCircle } from 'lucide-react';
import { NewSeasonWizard } from './newSeason/NewSeasonWizard';

export default function NewSeasonFromPreviousPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const { data: prefill, isLoading, error } = useNewSeasonPrefill(leagueId);

  // Soft confirm if the operator is more than 14 days out from the
  // current season's end. Per Ed (2026-05-17) — allow them to start
  // early but show a friendly nudge that most LOs wait. Hook fires
  // once on mount when the prefill data is in.
  useEffect(() => {
    if (!prefill) return;
    const ripe = isNextSeasonRipe(prefill.previousSeason, 1);
    if (ripe) return; // No warning needed
    // Active or upcoming season with end_date more than 14 days out.
    // Don't block — just nudge.
    (async () => {
      const proceed = await confirm({
        title: "You're a bit early",
        message:
          'Your current season has more than 2 weeks left. Most operators wait until the last 2 weeks before planning the next season. You can continue if you want.',
        confirmText: 'Continue planning',
        cancelText: 'Take me back',
        confirmVariant: 'default',
      });
      if (!proceed) navigate(`/league/${leagueId}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.previousSeason?.id]);

  if (isLoading) {
    return (
      <div>
        <PageHeader
          backTo={leagueId ? `/league/${leagueId}` : '/dashboard'}
          backLabel="Back to League"
          title="Start Next Season"
        />
        <div className="max-w-4xl mx-auto p-6">
          <LoadingState message="Loading previous season data..." />
        </div>
        {ConfirmDialogComponent}
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          backTo={leagueId ? `/league/${leagueId}` : '/dashboard'}
          backLabel="Back to League"
          title="Start Next Season"
        />
        <div className="max-w-4xl mx-auto p-6">
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load previous season"
            description={error instanceof Error ? error.message : String(error)}
          />
        </div>
        {ConfirmDialogComponent}
      </div>
    );
  }

  if (!prefill) {
    // League has no previous season — point operator to first-time setup.
    return (
      <div>
        <PageHeader
          backTo={leagueId ? `/league/${leagueId}` : '/dashboard'}
          backLabel="Back to League"
          title="Start Next Season"
        />
        <div className="max-w-4xl mx-auto p-6">
          <EmptyState
            icon={Calendar}
            title="No previous season to copy from"
            description="This league hasn't had a season yet. Use the first-time setup flow to create your first season."
          />
          <div className="flex justify-center mt-4">
            <Button
              loadingText="none"
              onClick={() => navigate(`/league/${leagueId}/create-season`)}
            >
              Create First Season
            </Button>
          </div>
        </div>
        {ConfirmDialogComponent}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        backTo={leagueId ? `/league/${leagueId}` : '/dashboard'}
        backLabel="Back to League"
        title="Start Next Season"
        subtitle={`Copying forward from "${prefill.previousSeason.season_name}"`}
      />
      <div className="max-w-4xl mx-auto p-6">
        <NewSeasonWizard prefill={prefill} />
      </div>
      {ConfirmDialogComponent}
    </div>
  );
}
