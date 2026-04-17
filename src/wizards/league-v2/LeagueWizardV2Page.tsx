/**
 * @fileoverview League Creation Wizard v2 — Dev Page
 *
 * Renders the WizardFlowShell with the "Create New League" 5-stage flow.
 * On mount, checks DB for existing progress and resumes at the right stage.
 *
 * ACCESS: Dev-only via `/create-league-v2/:orgId`
 */

import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DevOnly } from '@/dev/DevOnly';
import { PageHeader } from '@/components/PageHeader';
import { WizardFlowShell } from '@/components/wizard';
import { createNewLeagueFlow } from '@/flows/createNewLeagueFlow';
import { useFlowStageDetection } from './useFlowStageDetection';
import { useFlowStageHandlers } from './useFlowStageHandlers';

function LeagueWizardV2PageContent() {
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
      <div className="container mx-auto px-4 max-w-4xl py-8 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <>
      <PageHeader
        backTo={`/operator-dashboard/${orgId}`}
        backLabel="Back to Dashboard"
        title="Create New League (v2)"
        organizationId={orgId}
      />

      <div className="container mx-auto px-4 max-w-4xl py-8">
        <WizardFlowShell
          flow={createNewLeagueFlow}
          stageHandlers={stageHandlers}
          initialContext={context}
          startAtStage={firstIncompleteStage}
          onComplete={() => navigate(`/operator-dashboard/${orgId}`)}
          onCancel={() => navigate(`/operator-dashboard/${orgId}`)}
        />
      </div>
    </>
  );
}

export default function LeagueWizardV2Page() {
  return (
    <DevOnly>
      <LeagueWizardV2PageContent />
    </DevOnly>
  );
}
