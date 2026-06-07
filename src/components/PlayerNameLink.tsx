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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { User, MessageSquare, Flag, Ban, DollarSign, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemberId, useMemberById, useCreateOrOpenConversation, useBlockUser, useUnblockUser, useIsUserBlocked, useUserProfile } from '@/api/hooks';
import { queryKeys } from '@/api/queryKeys';
import { ReportUserModal } from '@/components/ReportUserModal';
import { InvitePlayerModal } from '@/components/InvitePlayerModal';
import { PlaceholderBadge } from '@/components/PlaceholderBadge';
import { RecordDuesModal } from '@/components/RecordDuesModal';
import { ConfirmDialog } from '@/components/shared';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { updatePlayerStartingHandicaps } from '@/api/queries/players';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

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
  const queryClient = useQueryClient();
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
  const [handicap3v3, setHandicap3v3] = useState<string>('0');
  const [handicap5v5, setHandicap5v5] = useState<string>('40');

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

  // Update starting handicaps mutation
  const updateHandicapsMutation = useMutation({
    mutationFn: ({ h3v3, h5v5 }: { h3v3: number; h5v5: number }) =>
      updatePlayerStartingHandicaps(playerId, h3v3, h5v5),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.detail(playerId) });
      queryClient.invalidateQueries({ queryKey: ['unauthorizedPlayers'] });
      queryClient.invalidateQueries({ queryKey: ['playerDetails'] });
      toast.success(`Starting handicaps set for ${displayName}!`);
      setShowHandicapModal(false);
    },
    onError: (error) => {
      logger.error('Error updating starting handicaps', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to set starting handicaps. Please try again.');
    },
  });

  // Handle handicap action click (operators only)
  const handleHandicapAction = () => {
    if (!isOperator) return;

    // Pre-fill with current values or defaults
    const current3v3 = memberData?.starting_handicap_3v3;
    const current5v5 = memberData?.starting_handicap_5v5;
    setHandicap3v3(current3v3 !== null && current3v3 !== undefined ? String(current3v3) : '0');
    setHandicap5v5(current5v5 !== null && current5v5 !== undefined ? String(current5v5) : '40');
    setOpen(false);
    setShowHandicapModal(true);
  };

  // Handle saving handicaps from modal
  const handleHandicapSave = () => {
    const h3v3 = parseFloat(handicap3v3);
    const h5v5 = parseFloat(handicap5v5);

    // Validate ranges
    if (isNaN(h3v3) || h3v3 < -2 || h3v3 > 2) {
      toast.error('Starting Handicap (3v3) must be between -2 and 2');
      return;
    }

    if (isNaN(h5v5) || h5v5 < 0 || h5v5 > 100) {
      toast.error('Starting Handicap (5v5) must be between 0 and 100');
      return;
    }

    updateHandicapsMutation.mutate({ h3v3, h5v5 });
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

      {/* Set Starting Handicaps Modal */}
      <Dialog open={showHandicapModal} onOpenChange={setShowHandicapModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Starting Handicaps</DialogTitle>
            <DialogDescription>
              Set starting handicaps for {displayName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current values display */}
            <div className="text-sm text-muted-foreground">
              Current: 3v3 = {memberData?.starting_handicap_3v3 ?? 'Not set'}, 5v5 = {memberData?.starting_handicap_5v5 ?? 'Not set'}
            </div>

            {/* 3v3 Handicap */}
            <div>
              <Label htmlFor="handicap3v3">Starting Handicap (3v3)</Label>
              <Select value={handicap3v3} onValueChange={setHandicap3v3}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select handicap" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-2">-2</SelectItem>
                  <SelectItem value="-1">-1</SelectItem>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">+1</SelectItem>
                  <SelectItem value="2">+2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 5v5 Handicap */}
            <div>
              <Label htmlFor="handicap5v5">
                Starting Handicap (5v5)
                <span className="text-xs text-muted-foreground ml-2">(0 to 100)</span>
              </Label>
              <Input
                id="handicap5v5"
                type="number"
                step="1"
                min="0"
                max="100"
                value={handicap5v5}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandicap5v5(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHandicapModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleHandicapSave} disabled={updateHandicapsMutation.isPending} loadingText="Saving..." isLoading={updateHandicapsMutation.isPending}>
              Save Handicaps
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
