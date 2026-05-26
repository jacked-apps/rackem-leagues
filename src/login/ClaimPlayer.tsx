/**
 * @fileoverview Claim Player Page
 *
 * This page handles the "existing user" flow for placeholder player invites.
 * When an existing authenticated user receives an invite email, they're directed
 * here to merge the placeholder player's history into their account.
 *
 * URL: /claim-player?claim={memberId}&token={token}
 *
 * Flow:
 * 1. Verify user is authenticated (redirect to login if not)
 * 2. Fetch invite details using the token
 * 3. Display PP name, team name, captain name
 * 4. On "Join Team" click, call claim-placeholder Edge Function
 * 5. On success, redirect to dashboard
 *
 * Security:
 * - Edge Function verifies the authenticated user's email matches the invite email
 * - Token must be valid and not expired/claimed/cancelled
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
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
import { logger } from '@/utils/logger';
import { useUser } from '@/context/useUser';
import { queryKeys } from '@/api/queryKeys';

/** Data returned from get_invite_details() */
interface InviteDetails {
  member_id: string;
  placeholder_first_name: string;
  placeholder_last_name: string;
  team_name: string;
  captain_name: string | null;
  expires_at: string;
  status: string;
}

/** Team info for displaying all teams the PP belongs to */
interface TeamInfo {
  team_id: string;
  team_name: string;
}

/** Extended placeholder context shown on the confirmation screen — lets the
 * invited user recognize (or reject) the record before any merge fires. */
interface PlaceholderExtras {
  nickname: string | null;
  hasPlayed: boolean;
  handicap3v3: number | null;
  handicap5v5: number | null;
}

/** State for the claim process */
type ClaimState =
  | 'loading'
  | 'not_authenticated'
  | 'valid'
  | 'expired'
  | 'invalid'
  | 'already_claimed'
  | 'success'
  | 'rejected'
  | 'error';

/**
 * Separate button component to handle the claiming action with proper loading state
 */
const ClaimButton: React.FC<{
  teamName: string;
  onClaim: () => Promise<void>;
  isClaiming: boolean;
}> = ({ teamName, onClaim, isClaiming }) => (
  <Button
    className="w-full"
    size="lg"
    loadingText="Joining Team..."
    isLoading={isClaiming}
    onClick={onClaim}
  >
    <UserCheck className="mr-2 h-4 w-4" />
    Join {teamName}
  </Button>
);

export const ClaimPlayer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: userLoading } = useUser();

  const claimId = searchParams.get('claim');
  const token = searchParams.get('token');

  const [claimState, setClaimState] = useState<ClaimState>('loading');
  const [isClaiming, setIsClaiming] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [mergeStats, setMergeStats] = useState<{
    teamsJoined: number;
    gamesTransferred: number;
    lineupsTransferred: number;
  } | null>(null);
  /** All teams the placeholder player belongs to */
  const [allTeams, setAllTeams] = useState<TeamInfo[]>([]);
  /** Placeholder context (nickname, has-played flag, handicaps) shown on the
   * confirmation screen so the invited user can visually verify the record. */
  const [placeholderExtras, setPlaceholderExtras] = useState<PlaceholderExtras | null>(null);
  /** Tracks the in-flight "This isn't me" request so we can disable both
   * buttons while it's running. */
  const [isRejecting, setIsRejecting] = useState(false);

  /**
   * Fetch invite details when component mounts
   * Uses the get_invite_details() PostgreSQL function
   */
  useEffect(() => {
    // Wait for user loading to complete
    if (userLoading) return;

    // If no user, they need to log in first
    if (!user) {
      setClaimState('not_authenticated');
      return;
    }

    // Validate URL params
    if (!token) {
      setClaimState('invalid');
      setErrorMessage('Missing invite token. Please use the link from your email.');
      return;
    }

    const fetchInviteDetails = async () => {
      try {
        const { data, error } = await supabase.rpc('get_invite_details', {
          p_token: token,
        });

        if (error) {
          logger.error('Error fetching invite details', { error: error.message });
          setClaimState('invalid');
          setErrorMessage('Could not load invite details. The link may be invalid.');
          return;
        }

        if (!data || data.length === 0) {
          setClaimState('invalid');
          setErrorMessage('This invite link is invalid or has already been used.');
          return;
        }

        const details = data[0] as InviteDetails;

        // Check status
        if (details.status === 'claimed') {
          setClaimState('already_claimed');
          setInviteDetails(details);
          return;
        }

        // Check expiration
        const expiresAt = new Date(details.expires_at);
        if (expiresAt < new Date() || details.status === 'expired') {
          setClaimState('expired');
          setInviteDetails(details);
          return;
        }

        if (details.status === 'cancelled') {
          setClaimState('invalid');
          setErrorMessage('This invite has been cancelled by the team captain.');
          return;
        }

        // Valid invite - now fetch all teams this PP belongs to
        setInviteDetails(details);

        // Fetch all teams the placeholder player is on
        const { data: teamData, error: teamsError } = await supabase
          .from('team_players')
          .select(`
            team_id,
            teams (
              id,
              team_name
            )
          `)
          .eq('member_id', details.member_id);

        if (!teamsError && teamData) {
          const teams: TeamInfo[] = teamData
            .filter((tp: any) => tp.teams && !Array.isArray(tp.teams))
            .map((tp: any) => ({
              team_id: tp.teams.id,
              team_name: tp.teams.team_name,
            }));
          setAllTeams(teams);
        }

        // Fetch extras (nickname + handicaps) plus the has-played flag so the
        // confirmation screen can show "John 'Lefty' Smith has played 8 games,
        // handicap 42". Failures here degrade gracefully — the page still works
        // without these enriched details.
        const [extrasResp, hasPlayedResp] = await Promise.all([
          supabase
            .from('members')
            .select('nickname, starting_handicap_3v3, starting_handicap_5v5')
            .eq('id', details.member_id)
            .single(),
          supabase.rpc('placeholder_has_stats', { p_member_id: details.member_id }),
        ]);

        if (!extrasResp.error && extrasResp.data) {
          setPlaceholderExtras({
            nickname: extrasResp.data.nickname,
            hasPlayed: Boolean(hasPlayedResp.data),
            handicap3v3: extrasResp.data.starting_handicap_3v3,
            handicap5v5: extrasResp.data.starting_handicap_5v5,
          });
        }

        setClaimState('valid');
      } catch (err) {
        logger.error('Unexpected error fetching invite', { error: err });
        setClaimState('invalid');
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    };

    fetchInviteDetails();
  }, [token, user, userLoading]);

  /**
   * Handle the claim action
   * Calls the claim-placeholder Edge Function
   */
  const handleClaim = async () => {
    if (!inviteDetails || !token || !user) return;

    setIsClaiming(true);
    setErrorMessage('');

    try {
      // Get the user's JWT for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;

      if (!jwt) {
        setIsClaiming(false);
        setClaimState('error');
        setErrorMessage('Session expired. Please log in again.');
        return;
      }

      // Call the Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claim-placeholder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            placeholderMemberId: inviteDetails.member_id,
            token: token,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        logger.error('Claim failed', { status: response.status, result });

        // Handle specific error cases
        if (response.status === 403 && result.error === 'Email mismatch') {
          setIsClaiming(false);
          setClaimState('error');
          setErrorMessage(
            'This invite was sent to a different email address. Please log in with the correct account.'
          );
          return;
        }

        setIsClaiming(false);
        setClaimState('error');
        setErrorMessage(result.details || result.error || 'Failed to claim player history.');
        return;
      }

      // Success!
      logger.info('Successfully claimed placeholder', {
        memberId: inviteDetails.member_id,
        stats: result.stats,
      });

      // Invalidate pending invites query so Dashboard doesn't show the modal again
      queryClient.invalidateQueries({ queryKey: queryKeys.invites.pending() });
      // Also invalidate member queries since user now has a linked member
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['currentMember'] });

      setMergeStats(result.stats);
      setClaimState('success');
    } catch (err) {
      logger.error('Network error during claim', { error: err });
      setIsClaiming(false);
      setClaimState('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  };

  /**
   * Handle the "This isn't me" action. Calls the reject-invite Edge Function
   * which marks the token rejected — no merge fires, the placeholder stays
   * in the LO's queue, and the token can't be reused by a stolen link.
   */
  const handleReject = async () => {
    if (!token || !user) return;

    setIsRejecting(true);
    setErrorMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) {
        setIsRejecting(false);
        setClaimState('error');
        setErrorMessage('Session expired. Please log in again.');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reject-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ token }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        logger.error('Reject failed', { status: response.status, result });
        setIsRejecting(false);
        setClaimState('error');
        setErrorMessage(result.details || result.error || 'Could not reject invite.');
        return;
      }

      logger.info('Invite rejected', { token });
      setClaimState('rejected');
    } catch (err) {
      logger.error('Network error during reject', { error: err });
      setIsRejecting(false);
      setClaimState('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  };

  // Loading state
  if (claimState === 'loading' || userLoading) {
    return (
      <LoginCard title="Loading..." description="Verifying your invite">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </LoginCard>
    );
  }

  // Not authenticated - redirect to login
  if (claimState === 'not_authenticated') {
    // Build the return URL so they come back here after login
    const returnUrl = `/claim-player?claim=${claimId}&token=${token}`;

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
          <Button
            className="w-full"
            loadingText="none"
            onClick={() => navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`)}
          >
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
  if (claimState === 'invalid') {
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
  if (claimState === 'expired' && inviteDetails) {
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
  if (claimState === 'already_claimed' && inviteDetails) {
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
  if (claimState === 'success' && inviteDetails) {
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
          <Button className="w-full" loadingText="none" onClick={() => navigate('/my-teams')}>
            Go to My Teams
          </Button>
        </div>
      </LoginCard>
    );
  }

  // Rejected state — user clicked "This isn't me"
  if (claimState === 'rejected') {
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
          <Button className="w-full" loadingText="none" onClick={() => navigate('/my-teams')}>
            Go to My Teams
          </Button>
        </div>
      </LoginCard>
    );
  }

  // Error state
  if (claimState === 'error') {
    return (
      <LoginCard title="Error" description="Something went wrong">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
          <p className="text-foreground">{errorMessage}</p>
          <Button variant="outline" onClick={() => setClaimState('valid')}>
            Try Again
          </Button>
        </div>
        <CardFooter className="mt-4 text-sm flex justify-around w-full">
          <Link to="/my-teams">Go to My Teams</Link>
        </CardFooter>
      </LoginCard>
    );
  }

  // Valid invite - show claim UI
  if (claimState === 'valid' && inviteDetails) {
    const hasMultipleTeams = allTeams.length > 1;

    return (
      <LoginCard
        title="Join Team"
        description={hasMultipleTeams
          ? "Claim your player history and join your teams"
          : "Claim your player history and join the team"
        }
      >
        <div className="space-y-6">
          {/* Invite details card */}
          <div className="bg-info/10 border border-info/40 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Users className="h-6 w-6 text-info mt-0.5" />
              <div>
                <p className="font-medium text-info">
                  {inviteDetails.captain_name
                    ? `${inviteDetails.captain_name} invited you to join`
                    : 'You\'ve been invited to join'}
                </p>
                {hasMultipleTeams ? (
                  <div className="mt-2">
                    <p className="text-sm text-foreground mb-2">
                      Your player profile is on {allTeams.length} teams:
                    </p>
                    <ul className="space-y-1">
                      {allTeams.map((team) => (
                        <li key={team.team_id} className="text-base font-semibold text-foreground">
                          • {team.team_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {inviteDetails.team_name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Player profile being claimed — richer details let the invited
              user recognize (or reject) the record before any merge fires. */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Claiming player profile:</p>
            <p className="text-lg font-semibold">
              {inviteDetails.placeholder_first_name}
              {placeholderExtras?.nickname ? ` "${placeholderExtras.nickname}" ` : ' '}
              {inviteDetails.placeholder_last_name}
            </p>
            {placeholderExtras && (
              <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {placeholderExtras.hasPlayed
                    ? 'Has played games'
                    : 'No game history yet'}
                </span>
                {placeholderExtras.handicap5v5 !== null && (
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    Handicap: {placeholderExtras.handicap5v5}
                  </span>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Your game history and stats will be merged into your account.
            </p>
          </div>

          {/* Multiple teams notice */}
          {hasMultipleTeams && (
            <div className="bg-warning/10 border border-warning/40 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="text-sm text-foreground">
                  <p className="font-medium mb-1">Important:</p>
                  <p>
                    Accepting this invite will add you to all {allTeams.length} teams listed above.
                    If you were added to a team by mistake, please contact your league operator
                    to remove you from that team <strong>before</strong> accepting this invite.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Claim button */}
          <ClaimButton
            teamName={hasMultipleTeams ? `${allTeams.length} Teams` : inviteDetails.team_name}
            onClaim={handleClaim}
            isClaiming={isClaiming}
          />

          {/* "This isn't me" escape hatch — for when the invited user opens
              the link, looks at the placeholder's name/handicap/history, and
              realizes it's someone else's record. No merge fires. */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={handleReject}
            disabled={isClaiming || isRejecting}
            isLoading={isRejecting}
            loadingText="Sending..."
          >
            This isn't me
          </Button>
          <p className="text-xs text-center text-muted-foreground -mt-2">
            Clicking this won't move any history. Your league operator will see
            the placeholder still needs a match.
          </p>
        </div>
      </LoginCard>
    );
  }

  // Fallback
  return null;
};
