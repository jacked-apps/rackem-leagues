/**
 * @fileoverview League Creation Wizard — Page
 *
 * Renders the WizardFlowShell with the "Create New League" 5-stage flow.
 * On mount, checks DB for existing progress and resumes at the right stage.
 */

import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { WizardFlowShell } from '@/components/wizard';
import { createNewLeagueFlow } from '@/flows/createNewLeagueFlow';
import { useFlowStageDetection } from './useFlowStageDetection';
import { useFlowStageHandlers } from './useFlowStageHandlers';

export default function LeagueWizardV2Page() {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const leagueId = searchParams.get('leagueId');
  const { isLoading, firstIncompleteStage, context } = useFlowStageDetection(leagueId);

  const stageHandlers = useFlowStageHandlers({
    orgId: orgId ?? '',
    context,
    onLeagueCreated: (id) => setSearchParams({ leagueId: id }, { replace: true }),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 max-w-4xl py-8 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  // Inject organizationId into the flow context so step components
  // can read it from formData._flowContext.organizationId instead of
  // pulling it from useParams (which only works on this route — the
  // next-season wizard's route doesn't have :orgId).
  const contextWithOrg = { ...context, organizationId: orgId ?? undefined };

  return (
    <>
      <PageHeader
        backTo={`/operator-dashboard/${orgId}`}
        backLabel="Back to Dashboard"
        title="Create New League"
        organizationId={orgId}
      />

      <div className="container mx-auto px-4 max-w-4xl py-8">
        <WizardFlowShell
          flow={createNewLeagueFlow}
          stageHandlers={stageHandlers}
          initialContext={contextWithOrg}
          startAtStage={firstIncompleteStage}
          onComplete={() => navigate(`/operator-dashboard/${orgId}`)}
          onCancel={() => navigate(`/operator-dashboard/${orgId}`)}
        />
      </div>
    </>
  );
}

