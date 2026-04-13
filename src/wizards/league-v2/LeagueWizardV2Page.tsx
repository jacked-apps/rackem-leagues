/**
 * @fileoverview League Creation Wizard v2 — Dev Page
 *
 * Renders the WizardFlowShell with the "Create New League" 5-stage flow.
 *
 * RESUME LOGIC: On mount, checks the URL for a leagueId param. If found,
 * queries the DB to determine which stages are already complete and skips
 * ahead. After the league is created (Stage 1), the URL is updated with
 * the leagueId so refreshes/cancels always resume correctly.
 *
 * ACCESS: Dev-only via `/create-league-v2/:orgId`
 */

import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DevOnly } from '@/dev/DevOnly';
import { PageHeader } from '@/components/PageHeader';
import { WizardFlowShell } from '@/components/wizard';
import type { StageHandlers } from '@/components/wizard/WizardFlowShell';
import { createNewLeagueFlow } from '@/flows/createNewLeagueFlow';
import { useCreateLeagueV2 } from './useCreateLeagueV2';
import { useFlowStageDetection } from './useFlowStageDetection';
import type { LeagueWizardFormData } from './leagueWizardTypes';

function LeagueWizardV2PageContent() {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const createLeague = useCreateLeagueV2({ organizationId: orgId ?? '' });

  // Check URL for leagueId (set after Stage 1 completes)
  const leagueId = searchParams.get('leagueId');

  // Query DB to determine which stages are already done
  const { isLoading, firstIncompleteStage, context } = useFlowStageDetection(leagueId);

  const stageHandlers: StageHandlers = {
    league: async (formData) => {
      const fd = formData as LeagueWizardFormData;
      const league = await createLeague.mutateAsync(fd);
      toast.success('League created');
      setSearchParams({ leagueId: league.id }, { replace: true });
      return { leagueId: league.id, leagueStartDate: fd['start-date'] };
    },
  };

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
