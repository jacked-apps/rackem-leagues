/**
 * @fileoverview League Creation Wizard v2 — Dev Page
 *
 * Renders the WizardFlowShell with the "Create New League" 5-stage flow.
 * Provides a stageHandler for the league stage that does the dual-write
 * (creates league row + upserts preferences row).
 *
 * ACCESS: Dev-only via `/create-league-v2/:orgId`.
 * See memory-bank/plans/PLAN-wizard2.md
 */

import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DevOnly } from '@/dev/DevOnly';
import { PageHeader } from '@/components/PageHeader';
import { WizardFlowShell } from '@/components/wizard';
import type { StageHandlers } from '@/components/wizard/WizardFlowShell';
import { createNewLeagueFlow } from '@/flows/createNewLeagueFlow';
import { useCreateLeagueV2 } from './useCreateLeagueV2';
import type { LeagueWizardFormData } from './leagueWizardTypes';

function LeagueWizardV2PageContent() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const createLeague = useCreateLeagueV2({ organizationId: orgId ?? '' });

  /** Stage handlers — run when each stage completes (e.g., DB writes) */
  const stageHandlers: StageHandlers = {
    league: async (formData) => {
      const league = await createLeague.mutateAsync(formData as LeagueWizardFormData);
      toast.success('League created');
      return { leagueId: league.id };
    },
  };

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
