/**
 * @fileoverview PlayerNameLink Component
 *
 * Reusable component that wraps player names and makes them interactive.
 * Shows a popover menu with actions: View Profile, Send Message, Report User, Block User.
 *
 * Usage:
 * <PlayerNameLink playerId="uuid" playerName="John Doe" />
 *
 * Replace regular player name displays throughout the app with this component
 * to provide consistent user interaction patterns.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { User, MessageSquare, Flag, Ban, DollarSign, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemberId, useMemberById, useCreateOrOpenConversation, useBlockUser, useUnblockUser, useIsUserBlocked, useUserProfile } from '@/api/hooks';
import { ReportUserModal } from '@/components/ReportUserModal';
import { InvitePlayerModal } from '@/components/InvitePlayerModal';
import { PlaceholderBadge } from '@/components/PlaceholderBadge';
import { RecordDuesModal } from '@/components/RecordDuesModal';
import { ConfirmDialog } from '@/components/shared';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { SetStartingHandicapsModal } from './SetStartingHandicapsModal';

interface CustomAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}

interface PlayerNameLinkProps {
  playerId: string;
  /**
   * Optional instant-display name (avoids a load flash before the internal
   * `useMemberById` fetch resolves). When omitted, the component renders the
   * fetched nickname / full name once the member query resolves.
   */
  playerName?: string;
  className?: string;
  /** Team ID for invite context (required for email invites) */
  teamId?: string;
  /** Team name for invite email content */
  teamName?: string;
  /** Captain's name for invite email content */
  captainName?: string;
  /** Captain's member ID for tracking who sent the invite */
  captainMemberId?: string;
  customActions?: CustomAction[];
  /**
   * Hide the inline `PlaceholderBadge` next to the trigger name. The badge
   * still appears inside the popover header (where surface area allows).
   * Useful in tight contexts like the unified scoreboard's player drawer
   * where the badge would visually dominate a small column.
   * @default false
   */
  hidePlaceholderBadge?: boolean;
}

export function PlayerNameLink({
  playerId,
  playerName,
  className,
  teamId,
  teamName,
  captainName,
  captainMemberId,
  customActions = [],
  hidePlaceholderBadge = false,
}: PlayerNameLinkProps) {
  const navigate = useNavigate();
  const memberId = useMemberId();
  const { canAccessLeagueOperatorFeatures } = useUserProfile();
  const isOperator = canAccessLeagueOperatorFeatures();

  const [open, setOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [showDuesModal, setShowDuesModal] = useState(false);
  const [showHandicapModal, setShowHandicapModal] = useState(false);

  // TanStack Query hooks
  const createOrOpenConversationMutation = useCreateOrOpenConversation();
  const blockUserMutation = useBlockUser();
  const unblockUserMutation = useUnblockUser();

  // Fetch full member data using existing hook (cached for 15 minutes)
  const { data: memberData } = useMemberById(playerId);

  // Derive values from member data
  const playerFullName = memberData ? `${memberData.first_name} ${memberData.last_name}` : undefined;
  const isPlaceholder = memberData?.user_id === null;
  const playerEmail = memberData?.email;

  // Defensive display fallback: when `playerName` is omitted or the parent
  // passed "Unknown" (their player Map missed this ID), fall back to
  // memberData.nickname (or full name) from our own useMemberById fetch. The
  // "real" fix lives upstream in the Map builders (useMatchScoring /
  // useSpectateMatch now query members directly by ID). This is a
  // belt-and-suspenders so any caller that passes only a `playerId` still
  // renders correctly. Always resolves to a string (never undefined).
  const displayName =
    (playerName && playerName !== 'Unknown')
      ? playerName
      : memberData
        ? memberData.nickname || `${memberData.first_name} ${memberData.last_name}`
        : (playerName ?? '');

  // Check if user is blocked (only fetch when popover is open)
  // Note: We can't conditionally enable this hook based on `open` state because hooks can't be conditional.
  // The hook itself already has `enabled: !!userId && !!otherUserId` built-in.
  const { data: isBlocked = false } = useIsUserBlocked(
    open && memberId ? memberId : undefined,
    open ? playerId : undefined
  );

  const handleViewProfile = () => {
    navigate(`/player/${playerId}`);
    setOpen(false);
  };

  const handleSendMessage = async () => {
    // Create/open DM with this player
    if (!memberId) {
      logger.error('Current user member ID not found');
      setOpen(false);
      return;
    }

    // Don't allow messaging yourself
    if (memberId === playerId) {
      setOpen(false);
      return;
    }

    try {
      const result = await createOrOpenConversationMutation.mutateAsync({
        userId1: memberId,
        userId2: playerId,
      });

      if (result?.conversationId) {
        // Navigate to messages with the conversation ID as state
        navigate('/messages', { state: { conversationId: result.conversationId } });
      }

      setOpen(false);
    } catch (error) {
      logger.error('Error creating/opening conversation', { error: error instanceof Error ? error.message : String(error) });
      setOpen(false);
    }
  };

  const handleReportUser = () => {
    // Open report modal
    setOpen(false);
    setShowReportModal(true);
  };

  const handleBlockToggle = () => {
    if (!memberId) {
      logger.error('Current user member ID not found');
      setOpen(false);
      return;
    }

    // Don't allow blocking yourself
    if (memberId === playerId) {
      setOpen(false);
      return;
    }

    // Show appropriate confirmation dialog
    if (isBlocked) {
      setShowUnblockConfirm(true);
    } else {
      setShowBlockConfirm(true);
    }
    setOpen(false);
  };

  const handleBlockConfirm = async () => {
    if (!memberId) return;

    try {
      await blockUserMutation.mutateAsync({
        blockerId: memberId,
        blockedUserId: playerId,
      });

      toast.success(`${displayName} has been blocked. You won't see messages from them.`);
    } catch (error) {
      logger.error('Error blocking user', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Failed to block user. Please try again.');
    }
  };

  const handleUnblockConfirm = async () => {
    if (!memberId) return;

    try {
      await unblockUserMutation.mutateAsync({
        blockerId: memberId,
        blockedUserId: playerId,
      });

      toast.success(`${displayName} has been unblocked.`);
    } catch (error) {
      logger.error('Error unblocking user', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Failed to unblock user. Please try again.');
    }
  };

  // Handle membership payment click (operators only)
  const handleMembershipAction = () => {
    if (!isOperator) return;
    setOpen(false);
    setShowDuesModal(true);
  };

  // Open the starting-handicaps modal (operators only). The modal owns the
  // form + write; it seeds itself from the player's current values on open.
  const handleHandicapAction = () => {
    if (!isOperator) return;
    setOpen(false);
    setShowHandicapModal(true);
  };

  // Determine if membership action should be shown and what label to use
  const hasMembershipPaid = !!memberData?.membership_paid_date;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium transition-colors inline-flex items-center gap-1.5',
              className
            )}
          >
            <span>{displayName}</span>
            {/* Universal "Placeholder" tag rendered everywhere a player's
                name renders through PlayerNameLink. Single source of
                truth for the visual marker — every roster, lineup,
                scoring screen, etc. gets it for free. memberData may
                still be loading; isPlaceholder defaults to false until
                we know, so the badge fades in once the lookup resolves
                rather than flashing on first render.
                Callers in tight visual contexts (e.g. the unified
                scoreboard's player drawer) can suppress the inline
                badge via `hidePlaceholderBadge` — the popover header
                still shows it where surface area is plentiful. */}
            {isPlaceholder && !hidePlaceholderBadge && <PlaceholderBadge size="sm" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <div className="flex flex-col">
            {/* Player Full Name Header */}
            <div className="px-4 py-3 border-b bg-muted">
              <div className="font-semibold text-foreground inline-flex items-center gap-1.5">
                <span>{playerFullName || playerName}</span>
                {isPlaceholder && <PlaceholderBadge size="sm" />}
              </div>
              {isPlaceholder && (
                <div className="text-xs text-amber-600 mt-1">
                  Unregistered
                </div>
              )}
            </div>

            {/* Register Player - Only for placeholder/unregistered users */}
            {isPlaceholder && (
              <button
                onClick={() => {
                  setOpen(false);
                  setShowRegisterModal(true);
                }}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Register Player</span>
              </button>
            )}

            {/* View Profile */}
            <button
              onClick={handleViewProfile}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span>View Profile</span>
            </button>

            {/* Send Message - Only for registered users */}
            {!isPlaceholder && (
              <button
                onClick={handleSendMessage}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left"
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>Send Message</span>
              </button>
            )}

            <div className="border-t" />

            {/* Report Player - Available for all users */}
            <button
              onClick={handleReportUser}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left text-orange-600"
            >
              <Flag className="h-4 w-4" />
              <span>Report Player</span>
            </button>

            {/* Block/Unblock User - Only for registered users */}
            {!isPlaceholder && (
              <button
                onClick={handleBlockToggle}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left text-red-600"
              >
                <Ban className="h-4 w-4" />
                <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
              </button>
            )}

            {/* Operator-Only Actions */}
            {isOperator && (
              <>
                <div className="border-t" />
                {/* Set Starting Handicaps */}
                <button
                  onClick={handleHandicapAction}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left text-blue-600"
                >
                  <UserCog className="h-4 w-4" />
                  <span>Set Starting H/C</span>
                </button>
                {/* Membership Payment */}
                <button
                  onClick={handleMembershipAction}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left",
                    hasMembershipPaid ? "text-red-600" : "text-green-600"
                  )}
                >
                  <DollarSign className="h-4 w-4" />
                  <span>{hasMembershipPaid ? 'Reverse Dues' : 'Mark Dues Paid'}</span>
                </button>
              </>
            )}

            {/* Custom Actions */}
            {customActions.length > 0 && (
              <>
                <div className="border-t" />
                {customActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      action.onClick();
                      setOpen(false);
                    }}
                    className={action.className || "flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left"}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Report Modal */}
      {showReportModal && (
        <ReportUserModal
          reportedUserId={playerId}
          reportedUserName={displayName}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Block User Confirmation */}
      <ConfirmDialog
        open={showBlockConfirm}
        onOpenChange={setShowBlockConfirm}
        title="Block User?"
        description={`Are you sure you want to block ${displayName}? You won't be able to message each other.`}
        confirmLabel="Block"
        cancelLabel="Cancel"
        onConfirm={handleBlockConfirm}
        variant="destructive"
      />

      {/* Unblock User Confirmation */}
      <ConfirmDialog
        open={showUnblockConfirm}
        onOpenChange={setShowUnblockConfirm}
        title="Unblock User?"
        description={`Unblock ${displayName}? You'll be able to message each other again.`}
        confirmLabel="Unblock"
        cancelLabel="Cancel"
        onConfirm={handleUnblockConfirm}
        variant="default"
      />

      {/* Record Dues Modal */}
      <RecordDuesModal
        open={showDuesModal}
        onOpenChange={setShowDuesModal}
        playerId={playerId}
        playerName={displayName}
        hasPaid={hasMembershipPaid}
      />

      {/* Set Starting Handicaps Modal — owns its own form + write. */}
      <SetStartingHandicapsModal
        open={showHandicapModal}
        onOpenChange={setShowHandicapModal}
        playerId={playerId}
        playerName={displayName}
        current3v3={memberData?.starting_handicap_3v3}
        current5v5={memberData?.starting_handicap_5v5}
      />

      {/* Invite Player Modal - For placeholder players */}
      <InvitePlayerModal
        open={showRegisterModal}
        onOpenChange={setShowRegisterModal}
        playerId={playerId}
        playerName={playerFullName || displayName}
        playerEmail={playerEmail}
        playerUserId={memberData?.user_id}
        teamId={teamId}
        teamName={teamName}
        captainName={captainName}
        captainMemberId={captainMemberId}
      />
    </>
  );
}
