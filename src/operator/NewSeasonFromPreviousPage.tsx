/**
 * @fileoverview "Create Next Season" page entry point.
 *
 * Thin wrapper around the existing `WizardFlowShell` framework. The
 * heavy lifting lives in:
 *   - `createNextSeasonFlow` — flow config (4 stages reusing the
 *     same wizard components as the first-time flow)
 *   - `useNextSeasonStageDetection` — DB-driven resume logic, gated
 *     on the latest UPCOMING season (so a completed previous season
 *     correctly starts the operator fresh at the Season stage)
 *   - `useNextSeasonFlowHandlers` — per-stage commit handlers,
 *     mostly delegating to the same mutation hooks the first-time
 *     flow uses (so any improvement in those hooks lands in both
 *     places)
 *
 * Route: `/operator/start-next-season/:leagueId`
 *
 * Pause/resume behavior: this wizard creates an upcoming season at
 * the end of Stage 1. From that point, leaving and coming back to
 * the league page → clicking "Create Next Season" again → drops the
 * operator at whichever stage was next, same as the first-time
 * wizard's "Continue Setup" behavior.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { WizardFlowShell } from '@/components/wizard';
import { createNextSeasonFlow } from '@/flows/createNextSeasonFlow';
import { useNextSeasonStageDetection } from '@/wizards/next-season/useNextSeasonStageDetection';
import { useNextSeasonFlowHandlers } from '@/wizards/next-season/useNextSeasonFlowHandlers';

export default function NewSeasonFromPreviousPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();

  const { isLoading, firstIncompleteStage, context } =
    useNextSeasonStageDetection(leagueId ?? null);

  const stageHandlers = useNextSeasonFlowHandlers({ context });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 max-w-4xl py-8 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <>
      <PageHeader
        backTo={leagueId ? `/league/${leagueId}` : '/dashboard'}
        backLabel="Back to League"
        title="Create Next Season"
      />
      <div className="container mx-auto px-4 max-w-4xl py-8">
        <WizardFlowShell
          flow={createNextSeasonFlow}
          stageHandlers={stageHandlers}
          initialContext={context}
          startAtStage={firstIncompleteStage}
          onComplete={() => leagueId && navigate(`/league/${leagueId}`)}
          onCancel={() => leagueId && navigate(`/league/${leagueId}`)}
        />
      </div>
    </>
  );
}
