/**
 * @fileoverview ClaimStatusScreen
 *
 * The terminal / status screens of the Claim Player flow — every non-interactive
 * state (loading, not-authenticated, invalid, expired, already-claimed, success,
 * rejected, error). Data-driven: the page passes the current `state` plus the
 * data each screen needs and three navigation callbacks. The interactive `valid`
 * screen stays in `ClaimPlayer` (it owns the claim/reject actions).
 *
 * Extracted from `ClaimPlayer` to keep that page focused on orchestration.
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardFooter } from '@/components/ui/card';
import { LoginCard } from './LoginCard';
import {
  AlertTriangle,
  UserCheck,
  Users,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { ClaimState, InviteDetails, MergeStats } from './claimPlayerTypes';

interface ClaimStatusScreenProps {
  state: ClaimState;
  inviteDetails: InviteDetails | null;
  errorMessage: string;
  mergeStats: MergeStats | null;
  /** not_authenticated → go log in (page builds the return URL). */
  onLogin: () => void;
  /** success / rejected → go to My Teams. */
  onDone: () => void;
  /** error → retry (back to the valid screen). */
  onTryAgain: () => void;
}

/**
 * Renders the right terminal screen for `state`, or `null` for the interactive
 * `valid` state (handled by the page) and unknown states.
 */
export function ClaimStatusScreen({
  state,
  inviteDetails,
  errorMessage,
  mergeStats,
  onLogin,
  onDone,
  onTryAgain,
}: ClaimStatusScreenProps) {
  // Loading state
  if (state === 'loading') {
    return (
      <LoginCard title="Loading..." description="Verifying your invite">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </LoginCard>
    );
  }

  // Not authenticated - redirect to login
  if (state === 'not_authenticated') {
    return (
      <LoginCard
        title="Login Required"
        description="Please log in to claim your player history"
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Users className="h-16 w-16 text-primary" />
          </div>
          <p className="text-foreground">
            You need to be logged in to claim your player history.
          </p>
          <Button className="w-full" loadingText="none" onClick={onLogin}>
            Log In to Continue
          </Button>
        </div>
        <CardFooter className="mt-4 text-sm flex justify-around w-full">
          <Link to="/register">Don't have an account? Register</Link>
        </CardFooter>
      </LoginCard>
    );
  }

  // Invalid token
  if (state === 'invalid') {
    return (
      <LoginCard title="Invalid Invite" description="There was a problem with your invite link">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-warning" />
          </div>
          <p className="text-foreground">{errorMessage}</p>
          <p className="text-muted-foreground text-sm">
            Please contact your team captain for a new invite link.
          </p>
        </div>
        <CardFooter className="mt-4 text-sm flex justify-around w-full">
          <Link to="/my-teams">Go to My Teams</Link>
        </CardFooter>
      </LoginCard>
    );
  }

  // Expired invite
  if (state === 'expired' && inviteDetails) {
    return (
      <LoginCard title="Invite Expired" description="This invite link has expired">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Clock className="h-16 w-16 text-warning" />
          </div>
          <p className="text-foreground">
            The invite to join <strong>{inviteDetails.team_name}</strong> has expired.
          </p>
          <p className="text-muted-foreground text-sm">
            Please ask{' '}
            {inviteDetails.captain_name ? (
              <strong>{inviteDetails.captain_name}</strong>
            ) : (
              'your team captain'
            )}{' '}
            to send you a new invite.
          </p>
        </div>
        <CardFooter className="mt-4 text-sm flex justify-around w-full">
          <Link to="/my-teams">Go to My Teams</Link>
        </CardFooter>
      </LoginCard>
    );
  }

  // Already claimed
  if (state === 'already_claimed' && inviteDetails) {
    return (
      <LoginCard title="Already Claimed" description="This invite has already been used">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <UserCheck className="h-16 w-16 text-success" />
          </div>
          <p className="text-foreground">
            The player profile for{' '}
            <strong>
              {inviteDetails.placeholder_first_name} {inviteDetails.placeholder_last_name}
            </strong>{' '}
            has already been claimed.
          </p>
          <p className="text-muted-foreground text-sm">
            If this was you, your history should already be in your account.
          </p>
        </div>
        <CardFooter className="mt-4 text-sm flex justify-around w-full">
          <Link to="/my-teams">Go to My Teams</Link>
        </CardFooter>
      </LoginCard>
    );
  }

  // Success state
  if (state === 'success' && inviteDetails) {
    return (
      <LoginCard title="Success!" description="Your player history has been merged">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-success" />
          </div>
          <p className="text-foreground">
            You've successfully joined <strong>{inviteDetails.team_name}</strong>!
          </p>
          {mergeStats && (
            <div className="bg-success/10 border border-success/40 rounded-lg p-4 text-left">
              <p className="text-sm font-medium text-success mb-2">
                Merged into your account:
              </p>
              <ul className="text-sm text-foreground space-y-1">
                {mergeStats.teamsJoined > 0 && (
                  <li>• {mergeStats.teamsJoined} team membership(s)</li>
                )}
                {mergeStats.gamesTransferred > 0 && (
                  <li>• {mergeStats.gamesTransferred} game(s)</li>
                )}
                {mergeStats.lineupsTransferred > 0 && (
                  <li>• {mergeStats.lineupsTransferred} lineup assignment(s)</li>
                )}
              </ul>
            </div>
          )}
          <Button className="w-full" loadingText="none" onClick={onDone}>
            Go to My Teams
          </Button>
        </div>
      </LoginCard>
    );
  }

  // Rejected state — user clicked "This isn't me"
  if (state === 'rejected') {
    return (
      <LoginCard
        title="Thanks for letting us know"
        description="The invite has been marked as not-a-match"
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <XCircle className="h-16 w-16 text-muted-foreground" />
          </div>
          <p className="text-foreground">
            We've flagged that this invite wasn't meant for you. No account
            history has been moved.
          </p>
          <p className="text-muted-foreground text-sm">
            Your league operator will see the placeholder still needs a match
            and can reach out if needed.
          </p>
          <Button className="w-full" loadingText="none" onClick={onDone}>
            Go to My Teams
          </Button>
        </div>
      </LoginCard>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <LoginCard title="Error" description="Something went wrong">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
          <p className="text-foreground">{errorMessage}</p>
          <Button variant="outline" onClick={onTryAgain}>
            Try Again
          </Button>
        </div>
        <CardFooter className="mt-4 text-sm flex justify-around w-full">
          <Link to="/my-teams">Go to My Teams</Link>
        </CardFooter>
      </LoginCard>
    );
  }

  // 'valid' (handled by the page) and any unknown state render nothing here.
  return null;
}
