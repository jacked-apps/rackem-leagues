/**
 * @fileoverview The public /join/:token page — the onboarding cascade's front door.
 *
 * A person taps a forwarded team link or scans its QR and lands here. This
 * orchestrator reads the token's public join view and routes to the right step:
 *
 *   invalid/expired link        → invalid-link card
 *   already approved here        → "you're in" card → go to team
 *   already has a pending request→ "waiting" card
 *   not signed in                → inline email-code sign-in (stays on /join)
 *   signed in, no profile yet     → the short profile form (returns here on done)
 *   signed in + registered        → the Join / claim step
 *
 * Because sign-in is in-page and the profile form returns to THIS url, the join
 * intent is simply the page itself; the team_join_requests row is the durable
 * record once submitted. (A cross-device pre-submit hand-off would re-open the
 * shared link — acceptable for a forwardable address.)
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CompleteProfileForm } from '@/completeProfile/CompleteProfileForm';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useTeamJoinView } from '@/api/hooks/useTeamJoinView';
import { JoinStatusCard } from './components/JoinStatusCard';
import { JoinSignInStep } from './components/JoinSignInStep';
import { JoinSubmitStep } from './components/JoinSubmitStep';

/** Centered shell shared by every card-based join state. */
const JoinShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-muted flex items-start justify-center p-4">
    <div className="w-full max-w-md mt-12">{children}</div>
  </div>
);

export const TeamJoinPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isLoggedIn } = useUser();
  const { member, loading: memberLoading } = useUserProfile();
  const { data: view, isLoading, isError } = useTeamJoinView(token);

  // Loading the team behind the link.
  if (isLoading) {
    return (
      <JoinShell>
        <JoinStatusCard title="Loading…" message="Fetching this team's join page." />
      </JoinShell>
    );
  }

  // Bad/unknown/expired token.
  if (isError || !view?.found) {
    return (
      <JoinShell>
        <JoinStatusCard
          title="This link isn't valid"
          message="The join link may be mistyped or expired. Ask whoever shared it for a fresh link."
        />
      </JoinShell>
    );
  }

  // Already approved on this team → straight to their team.
  if (view.viewer_request_status === 'approved') {
    return (
      <JoinShell>
        <JoinStatusCard
          title="You're on the team!"
          message={`You've been added to ${view.team_name}.`}
          action={
            <Button loadingText="none" onClick={() => navigate('/my-teams')}>
              Go to my team
            </Button>
          }
        />
      </JoinShell>
    );
  }

  // Request already pending → waiting for the captain.
  if (view.viewer_request_status === 'pending') {
    return (
      <JoinShell>
        <JoinStatusCard
          title="You're on the list"
          message={`Your request to join ${view.team_name} is waiting for the captain to approve it. We'll let you know as soon as you're in.`}
        />
      </JoinShell>
    );
  }

  // Not signed in → inline email-code sign-in (no navigation away).
  if (!isLoggedIn) {
    return (
      <JoinShell>
        <JoinSignInStep
          token={token!}
          teamName={view.team_name ?? 'this team'}
          leagueName={view.league_name}
        />
      </JoinShell>
    );
  }

  // Signed in, member profile still loading.
  if (memberLoading) {
    return (
      <JoinShell>
        <JoinStatusCard title="One sec…" message="Loading your profile." />
      </JoinShell>
    );
  }

  // Signed in but no profile yet → the short profile form. It full-reloads back
  // to this page on completion, where the member check below now passes.
  if (!member) {
    return <CompleteProfileForm redirectTo={`/join/${token}`} />;
  }

  // Signed in + registered → ask to join / claim a spot.
  return (
    <JoinShell>
      <JoinSubmitStep token={token!} view={view} />
    </JoinShell>
  );
};
