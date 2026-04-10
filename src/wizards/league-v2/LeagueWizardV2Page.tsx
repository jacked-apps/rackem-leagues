/**
 * @fileoverview League Creation Wizard v2 — Dev Page
 *
 * Entry point for the new modular league creation wizard.
 *
 * ACCESS: Dev-only via `/create-league-v2/:orgId`. Wrapped in DevOnly
 * so it's invisible in production builds. The "Create League (v2)"
 * button on the operator dashboard (ActiveLeagues.tsx) links here.
 *
 * On "Finish": creates a league row + upserts a preferences row with
 * the modular fields (dual-write pattern). Then shows a success screen
 * with options to continue setup or go to the dashboard.
 *
 * See memory-bank/plans/PLAN-wizard2.md
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DevOnly } from '@/dev/DevOnly';
import { PageHeader } from '@/components/PageHeader';
import { WizardShell } from '@/components/wizard';
import { leagueWizardConfig } from './leagueWizardConfig';
import { useCreateLeagueV2 } from './useCreateLeagueV2';
import { LeagueCreatedScreen } from './LeagueCreatedScreen';
import type { LeagueWizardFormData } from './leagueWizardTypes';

function LeagueWizardV2PageContent() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [createdLeagueId, setCreatedLeagueId] = useState<string | null>(null);
  const createLeague = useCreateLeagueV2({ organizationId: orgId ?? '' });

  const handleComplete = async (formData: LeagueWizardFormData) => {
    try {
      const league = await createLeague.mutateAsync(formData);
      setCreatedLeagueId(league.id);
      toast.success('League created successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create league');
    }
  };

  const handleCancel = () => {
    navigate(`/operator-dashboard/${orgId}`);
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
        {createdLeagueId ? (
          <LeagueCreatedScreen leagueId={createdLeagueId} orgId={orgId ?? ''} />
        ) : (
          <WizardShell
            wizard={leagueWizardConfig}
            persistKey="wizard-v2:standalone:league-creation-v2:formData"
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        )}
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
