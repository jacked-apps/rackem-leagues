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

import { useParams } from 'react-router-dom';
import { DevOnly } from '@/dev/DevOnly';
import { PageHeader } from '@/components/PageHeader';

function LeagueWizardV2PageContent() {
  const { orgId } = useParams<{ orgId: string }>();

  return (
    <>
      <PageHeader
        backTo={`/operator-dashboard/${orgId}`}
        backLabel="Back to Dashboard"
        title="Create New League (v2)"
        organizationId={orgId}
      />

      <div className="container mx-auto px-4 max-w-4xl py-8">
        <div className="p-8 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
          <p className="text-blue-900 font-medium mb-2">Phase 0 stub</p>
          <p className="text-sm text-blue-800">
            The wizard framework is being built. This page will host the
            WizardFlowShell with the &ldquo;Create New League&rdquo; flow
            once Phase 6 and Phase 9 complete.
          </p>
        </div>
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
