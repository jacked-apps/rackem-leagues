/**
 * @fileoverview League Creation Wizard v2 — Dev Page
 *
 * Entry point for the new modular league creation flow. This page is
 * accessible only in development mode via the hidden route
 * `/operator/leagues/create-v2/:orgId`.
 *
 * Currently a stub. Will host the WizardFlowShell with the "Create New
 * League" flow once the framework is built out.
 *
 * See memory-bank/plans/PLAN-wizard2.md
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DevOnly } from '@/dev/DevOnly';
import { PageHeader } from '@/components/PageHeader';
import { WizardShell } from '@/components/wizard';
import { leagueWizardConfig } from './leagueWizardConfig';
import type { LeagueWizardFormData } from './leagueWizardTypes';

function LeagueWizardV2PageContent() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [completedData, setCompletedData] = useState<LeagueWizardFormData | null>(null);

  const handleComplete = (formData: LeagueWizardFormData) => {
    setCompletedData(formData);
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
        {completedData ? (
          <div className="p-6 border-2 border-green-300 rounded-lg bg-green-50">
            <p className="text-green-900 font-medium mb-2">
              Wizard completed (Phase 1 — no DB write yet)
            </p>
            <p className="text-sm text-green-800 mb-2">
              Captured form data:
            </p>
            <pre className="text-xs bg-white p-3 rounded border border-green-200 overflow-auto">
              {JSON.stringify(completedData, null, 2)}
            </pre>
          </div>
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
