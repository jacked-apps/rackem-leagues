/**
 * @fileoverview Dedicated "Season re-up" page.
 *
 * Reachable from the hamburger drawer when the current user has any
 * open re-up forms. Same UI as the modal but full-page — for captains
 * who keep tapping "Not now" but want to deal with it on their own
 * time without waiting for the next modal pop.
 *
 * Route: `/reup`
 */

import { useNavigate } from 'react-router-dom';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useCaptainReupPrompt } from '@/hooks/useCaptainReupPrompt';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, EmptyState } from '@/components/shared';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CaptainReupForm } from '@/components/reup/CaptainReupForm';

export default function CaptainReupPage() {
  const navigate = useNavigate();
  const { data: member } = useCurrentMember();
  const { data: teams = [], isLoading } = useCaptainReupPrompt();

  if (isLoading || !member) {
    return (
      <div>
        <PageHeader backTo="/dashboard" backLabel="Dashboard" title="Season Re-Up" />
        <div className="max-w-2xl mx-auto p-6">
          <LoadingState message="Loading your teams..." />
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div>
        <PageHeader backTo="/dashboard" backLabel="Dashboard" title="Season Re-Up" />
        <div className="max-w-2xl mx-auto p-6">
          <EmptyState
            icon={CheckCircle2}
            title="Nothing pending"
            description="You don't have any season re-up forms to fill out right now."
          />
          <div className="flex justify-center mt-4">
            <Button loadingText="none" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        backTo="/dashboard"
        backLabel="Dashboard"
        title="Season Re-Up"
        subtitle="Let your league operator know your plans for next season"
      />
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {teams.map((team) => (
          <div key={team.teamId} className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-lg">{team.teamName}</h2>
            </div>
            <CaptainReupForm
              team={team}
              submittedByCaptainId={member.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
