/**
 * @fileoverview Invite Player Modal
 *
 * Modal for inviting placeholder players to register and claim their profile.
 * Email-first approach: captains can enter the player's email which enables
 * various invite methods.
 *
 * Flow:
 * 1. Captain enters player's email (optional but recommended)
 * 2. Email is saved to PP record (enables multi-team capability)
 * 3. Captain chooses invite method:
 *    - Email invite: Sends branded email via Edge Function
 *    - In-app message: For users who already have accounts
 *    - Device handoff: In-person registration on captain's device
 *    - Share link: Copy link or show QR code
 *
 * Key behavior:
 * - If player already has an account (email in auth.users), email method MUST be used
 * - Email is always saved to PP record when entered (identity anchor)
 * - PP with email can be on multiple teams
 */
import { useState, useMemo, useEffect } from 'react';
import { Check, Smartphone, AlertTriangle, ArrowLeft, Mail, Save, MessageSquare, Pencil, RefreshCw, Key } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DeviceHandoffForm, InviteSuccessView, ShareLinkSection } from './invite';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { useInviteStatuses, usePlayerTeamCount } from '@/api/hooks';
import { queryKeys } from '@/api/queryKeys';

/** Modes for the modal */
type ModalMode = 'options' | 'handoff' | 'success';

/**
 * Determine current environment based on hostname
 * Returns: 'local' | 'staging' | 'production'
 */
function getEnvironment(): 'local' | 'staging' | 'production' {
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    return 'local';
  }

  // TODO: Update these with your actual domains
  if (hostname.includes('staging') || hostname.includes('dev') || hostname.includes('test')) {
    return 'staging';
  }

  return 'production';
}

interface InvitePlayerModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** The player's member ID */
  playerId: string;
  /** The player's display name */
  playerName: string;
  /** The player's current email (if already set on PP record) */
  playerEmail?: string | null;
  /** The player's user_id if they are registered (null for placeholder players) */
  playerUserId?: string | null;
  /** Team ID for invite context */
  teamId?: string;
  /** Team name for email content */
  teamName?: string;
  /** Captain's name for email content */
  captainName?: string;
  /** Captain's member ID for tracking who sent the invite */
  captainMemberId?: string;
}

/**
 * InvitePlayerModal Component
 *
 * Email-first approach to inviting placeholder players.
 * Allows saving email to PP record and provides multiple invite methods.
 */
export function InvitePlayerModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  playerEmail: initialEmail,
  playerUserId,
  teamId,
  teamName,
  captainName,
  captainMemberId,
}: InvitePlayerModalProps) {
  const queryClient = useQueryClient();

  // Fetch existing invite status for this player
  const { getInviteStatus, refetch: refetchInviteStatus } = useInviteStatuses([playerId]);
  const existingInvite = getInviteStatus(playerId);
  const hasExistingInvite = existingInvite !== null && existingInvite.status === 'pending';
  const hasExpiredInvite = existingInvite !== null && (existingInvite.status === 'expired' || existingInvite.isExpired);

  // Check if we have the required context for sending email invites
  // teamId and captainMemberId are required by the edge function
  const hasTeamContext = !!teamId && !!captainMemberId;

  // Check if the player is a registered user (has a user_id)
  // In-app messaging is only available for registered users
  const isRegisteredUser = !!playerUserId;

  // Modal mode state
  const [mode, setMode] = useState<ModalMode>('options');

  // Email state - pre-fill if already set on PP
  const [email, setEmail] = useState(initialEmail || '');
  const [emailSaved, setEmailSaved] = useState(!!initialEmail);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  // Track if user is editing a pre-existing email
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);

  // Options mode state
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isCreatingToken, setIsCreatingToken] = useState(false);

  // Handoff success state - stores email for success view
  const [handoffEmail, setHandoffEmail] = useState('');

  // Detect current environment (for staging warning)
  const environment = useMemo(() => getEnvironment(), []);
  const isStaging = environment === 'staging';

  // Generate the registration link
  const registrationLink = `${window.location.origin}/register?claim=${playerId}`;

  // Fetch team count for display (how many teams this PP is on)
  const { teamCount } = usePlayerTeamCount(playerId, open);

  // Reset email state when modal opens with new player
  useEffect(() => {
    if (open) {
      setEmail(initialEmail || '');
      setEmailSaved(!!initialEmail);
      setIsEditingEmail(!initialEmail); // Show input if no email, show display if email exists
    }
  }, [open, initialEmail]);

  /**
   * Reset all form state when modal closes or mode changes
   */
  const resetForm = () => {
    setHandoffEmail('');
  };

  /**
   * Handle modal close - reset to options mode
   */
  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset everything when closing
      setMode('options');
      resetForm();
    }
    onOpenChange(newOpen);
  };

  /**
   * Save email to PP record
   * This enables multi-team capability and identity verification
   */
  const handleSaveEmail = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSavingEmail(true);

    try {
      const { error: updateError } = await supabase
        .from('members')
        .update({ email: email.trim() })
        .eq('id', playerId);

      if (updateError) {
        logger.error('Failed to save email to PP', { error: updateError.message });
        toast.error('Failed to save email. Please try again.');
        return;
      }

      setEmailSaved(true);
      toast.success('Email saved');

      // Invalidate member queries so UI updates
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member', playerId] });

    } catch (err) {
      logger.error('Unexpected error saving email', { error: err });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSavingEmail(false);
    }
  };

  /**
   * Send email invite via Edge Function
   */
  const handleSendEmailInvite = async () => {
    if (!email.trim()) {
      toast.error('Please enter and save an email address first');
      return;
    }

    // Save email first if not already saved
    if (!emailSaved) {
      await handleSaveEmail();
    }

    setIsSendingInvite(true);

    try {
      const { error: fnError } = await supabase.functions.invoke('send-invite', {
        body: {
          memberId: playerId,
          email: email.trim(),
          teamId,
          invitedByMemberId: captainMemberId,
          teamName: teamName || 'your team',
          captainName: captainName || 'Your captain',
          baseUrl: window.location.origin,
        },
      });

      if (fnError) {
        logger.error('Failed to send email invite', { error: fnError.message });
        toast.error('Failed to send invite email. Please try again.');
        return;
      }

      const isResend = hasExistingInvite || hasExpiredInvite;
      toast.success(isResend ? `Invite resent to ${email}` : `Invite sent to ${email}`);
      logger.info('Email invite sent', { memberId: playerId, email: email.trim(), isResend });

      // Invalidate invite queries so status updates
      refetchInviteStatus();
      queryClient.invalidateQueries({ queryKey: queryKeys.invites.byMembers([playerId]) });

      // Close modal after successful send
      handleClose(false);

    } catch (err) {
      logger.error('Unexpected error sending email invite', { error: err });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSendingInvite(false);
    }
  };

  /**
   * Create an invite token without sending an email
   * Useful when the operator wants to track the invite but will communicate
   * the link through other means (phone, in-person, etc.)
   */
  const handleCreateToken = async () => {
    if (!email.trim()) {
      toast.error('Please enter and save an email address first');
      return;
    }

    // Save email first if not already saved
    if (!emailSaved) {
      await handleSaveEmail();
    }

    if (!hasTeamContext) {
      toast.error('Team context required to create invite token');
      return;
    }

    setIsCreatingToken(true);

    try {
      // Insert directly into invite_tokens table
      const { data: newInvite, error: insertError } = await supabase
        .from('invite_tokens')
        .insert({
          member_id: playerId,
          email: email.trim().toLowerCase(),
          team_id: teamId,
          invited_by_member_id: captainMemberId,
          status: 'pending',
        })
        .select('token')
        .single();

      if (insertError) {
        // Check if it's a duplicate - there might already be a pending invite
        if (insertError.code === '23505') {
          toast.error('An invite token already exists for this player');
        } else {
          logger.error('Failed to create invite token', { error: insertError.message });
          toast.error('Failed to create invite token. Please try again.');
        }
        return;
      }

      toast.success('Invite token created! Share the registration link with the player.');
      logger.info('Invite token created (no email sent)', {
        memberId: playerId,
        email: email.trim(),
        token: newInvite.token
      });

      // Invalidate invite queries so status updates
      refetchInviteStatus();
      queryClient.invalidateQueries({ queryKey: queryKeys.invites.byMembers([playerId]) });

      // Don't close modal - user may want to copy the link

    } catch (err) {
      logger.error('Unexpected error creating invite token', { error: err });
      toast.error('An unexpected error occurred');
    } finally {
      setIsCreatingToken(false);
    }
  };

  /**
   * Start device handoff flow - switch to handoff mode
   */
  const handleDeviceHandoff = () => {
    resetForm();
    // Pre-fill email if we have it
    setHandoffEmail(email || '');
    setMode('handoff');
  };

  /**
   * Go back to options from handoff mode
   */
  const handleBackToOptions = () => {
    resetForm();
    setMode('options');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        {/* ============ OPTIONS MODE ============ */}
        {mode === 'options' && (
          <>
            <DialogHeader>
              <DialogTitle>Invite Player</DialogTitle>
              <DialogDescription>
                Help <span className="font-medium text-foreground">{playerName}</span> create their account and claim their profile
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto -mx-6 px-6" style={{ maxHeight: '55vh' }}>
              <div className="space-y-6 py-2">
              {/* Email Section - Top Priority */}
              <div className="space-y-3 p-4 bg-muted rounded-lg border">
                <Label className="text-sm font-medium">Player's Email</Label>

                {/* Display mode - email already exists on PP */}
                {!isEditingEmail && emailSaved && email ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 p-2 bg-card rounded border">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{email}</span>
                      </div>
                      {/* Only allow editing if there's no pending invite */}
                      {!hasExistingInvite && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingEmail(true)}
                          className="shrink-0 h-7 px-2"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                    {/* Show different message based on invite status */}
                    {hasExistingInvite ? (
                      <div className="space-y-1">
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Email locked. League Operator must cancel invite to change email.
                        </p>
                        {teamCount > 1 && (
                          <p className="text-xs text-muted-foreground">
                            This player is on {teamCount} teams. Accepting the invite will link all teams to their account.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Email on file - ready to send invite
                      </p>
                    )}
                  </div>
                ) : (
                  /* Edit mode - no email or user clicked edit */
                  <>
                    <p className="text-xs text-muted-foreground">
                      Enter the player's email to enable invite options and allow them to be on multiple teams.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="player@example.com"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setEmail(e.target.value);
                          setEmailSaved(false); // Mark as unsaved when changed
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant={emailSaved ? 'outline' : 'default'}
                        size="sm"
                        onClick={async () => {
                          await handleSaveEmail();
                          // After saving, switch back to display mode if we had an initial email
                          if (email.trim()) {
                            setIsEditingEmail(false);
                          }
                        }}
                        disabled={isSavingEmail || !email.trim() || emailSaved}
                        isLoading={isSavingEmail}
                        loadingText="Saving..."
                        className="shrink-0"
                      >
                        {emailSaved ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Option 1: Email Invite - For existing accounts or new users */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Email Invite</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Send an email or message to connect this profile to a registered or new player. This is the only method to connect existing accounts.
                  </p>
                </div>

                {/* Show warning if team context is missing */}
                {!hasTeamContext && (
                  <div className="p-3 rounded-lg border bg-muted border-border">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Email invites must be sent from a team context.
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      To send an email invite, open this player from Team Management.
                    </p>
                  </div>
                )}

                {/* Show existing invite status if applicable */}
                {hasTeamContext && (hasExistingInvite || hasExpiredInvite) && existingInvite && (
                  <div className={`p-3 rounded-lg border ${hasExpiredInvite ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-center gap-2 text-sm">
                      {hasExpiredInvite ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Mail className="h-4 w-4 text-green-600" />
                      )}
                      <span className={hasExpiredInvite ? 'text-amber-800' : 'text-green-800'}>
                        {hasExpiredInvite
                          ? 'Previous invite has expired'
                          : `Invite sent ${new Date(existingInvite.createdAt).toLocaleDateString()}`}
                      </span>
                    </div>
                    {hasExistingInvite && (
                      <p className="text-xs text-green-700 mt-1">
                        Expires {new Date(existingInvite.expiresAt || '').toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="default"
                    className="gap-1 px-3"
                    onClick={handleSendEmailInvite}
                    disabled={!email.trim() || isSendingInvite || !hasTeamContext}
                    isLoading={isSendingInvite}
                    loadingText="..."
                  >
                    {hasExistingInvite || hasExpiredInvite ? (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        <span className="hidden sm:inline">Resend</span> Email
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Email
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1 px-3"
                    disabled={!email.trim() || !isRegisteredUser}
                    title={!isRegisteredUser ? 'Only available for registered users' : 'Coming soon'}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1 px-3"
                    onClick={handleCreateToken}
                    disabled={!email.trim() || isCreatingToken || !hasTeamContext || hasExistingInvite}
                    isLoading={isCreatingToken}
                    loadingText="..."
                    title={hasExistingInvite ? 'Invite already sent' : 'Create invite without sending notification'}
                  >
                    <Key className="h-4 w-4" />
                    {hasExistingInvite ? 'Invited' : 'Invite Only'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  "Invite Only" creates the invite without sending a notification. Share the link below manually.
                </p>

                {!email.trim() && (
                  <p className="text-xs text-amber-600">Enter and save an email above to enable these options.</p>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or for new players</span>
                </div>
              </div>

              {/* Option 2: In-Person Device Handoff */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">In-Person Registration</Label>
                <p className="text-xs text-muted-foreground">
                  Hand your device to the player so they can register right now.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={handleDeviceHandoff}
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Start Device Handoff</span>
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or share link</span>
                </div>
              </div>

              {/* Option 3 & 4: Share Link & QR Code */}
              <ShareLinkSection
                registrationLink={registrationLink}
                isStaging={isStaging}
              />
              </div>
            </div>
          </>
        )}

        {/* ============ HANDOFF MODE ============ */}
        {mode === 'handoff' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackToOptions}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <DialogTitle>Device Handoff</DialogTitle>
              </div>
              <DialogDescription>
                Hand your device to <span className="font-medium text-foreground">{playerName}</span> to complete registration
              </DialogDescription>
            </DialogHeader>

            <DeviceHandoffForm
              playerId={playerId}
              playerName={playerName}
              initialEmail={email}
              onSuccess={(successEmail) => {
                setHandoffEmail(successEmail);
                setMode('success');
              }}
              onBack={handleBackToOptions}
            />
          </>
        )}

        {/* ============ SUCCESS MODE ============ */}
        {mode === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>Account Created!</DialogTitle>
            </DialogHeader>

            <InviteSuccessView
              playerName={playerName}
              email={handoffEmail}
              onClose={() => handleClose(false)}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
