/**
 * @fileoverview usePlayerSocialActions — the "Send Message" and
 * "Block / Unblock" actions behind the `PlayerNameLink` popover.
 *
 * Extracted from `PlayerNameLink.tsx` so the component is mostly layout.
 * Everything here acts as the signed-in member toward one other player.
 *
 * Rules carried over unchanged:
 * - You can't message or block yourself (the action just closes the menu).
 * - No signed-in member id → log an error and close the menu.
 * - Block/unblock goes through a confirm dialog first; the hook only decides
 *   WHICH confirm to open (`requestBlockToggle`) and runs the write once the
 *   user confirms (`confirmBlock` / `confirmUnblock`).
 * - The blocked-status lookup only runs while the popover is open, so a page
 *   full of names doesn't fire one query per name.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useMemberId,
  useCreateOrOpenConversation,
  useBlockUser,
  useUnblockUser,
  useIsUserBlocked,
} from '@/api/hooks';
import { logger } from '@/utils/logger';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Message and block actions for one player.
 *
 * @param playerId - members.id of the player whose name was tapped
 * @param displayName - name used in the block/unblock toasts
 * @param menuOpen - whether the popover is open (gates the blocked lookup)
 * @param closeMenu - closes the popover
 * @returns `isBlocked`, the two confirm-dialog open states + setters,
 *   `sendMessage`, `requestBlockToggle`, `confirmBlock`, `confirmUnblock`
 */
export function usePlayerSocialActions(
  playerId: string,
  displayName: string,
  menuOpen: boolean,
  closeMenu: () => void
) {
  const navigate = useNavigate();
  const memberId = useMemberId();
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);

  const createOrOpenConversationMutation = useCreateOrOpenConversation();
  const blockUserMutation = useBlockUser();
  const unblockUserMutation = useUnblockUser();

  // The hook has `enabled: !!userId && !!otherUserId` built in, so passing
  // undefined while the menu is closed keeps it idle.
  const { data: isBlocked = false } = useIsUserBlocked(
    menuOpen && memberId ? memberId : undefined,
    menuOpen ? playerId : undefined
  );

  /** Open (or create) the DM with this player and go to Messages. */
  const sendMessage = async () => {
    if (!memberId) {
      logger.error('Current user member ID not found');
      closeMenu();
      return;
    }
    if (memberId === playerId) {
      closeMenu();
      return;
    }

    try {
      const result = await createOrOpenConversationMutation.mutateAsync({
        userId1: memberId,
        userId2: playerId,
      });
      if (result?.conversationId) {
        navigate('/messages', { state: { conversationId: result.conversationId } });
      }
      closeMenu();
    } catch (error) {
      logger.error('Error creating/opening conversation', { error: errorText(error) });
      closeMenu();
    }
  };

  /** Open the block or unblock confirm, depending on the current state. */
  const requestBlockToggle = () => {
    if (!memberId) {
      logger.error('Current user member ID not found');
      closeMenu();
      return;
    }
    if (memberId === playerId) {
      closeMenu();
      return;
    }

    if (isBlocked) {
      setShowUnblockConfirm(true);
    } else {
      setShowBlockConfirm(true);
    }
    closeMenu();
  };

  /** Runs after the user confirms "Block". */
  const confirmBlock = async () => {
    if (!memberId) return;
    try {
      await blockUserMutation.mutateAsync({ blockerId: memberId, blockedUserId: playerId });
      toast.success(`${displayName} has been blocked. You won't see messages from them.`);
    } catch (error) {
      logger.error('Error blocking user', { error: errorText(error) });
      toast.error('Failed to block user. Please try again.');
    }
  };

  /** Runs after the user confirms "Unblock". */
  const confirmUnblock = async () => {
    if (!memberId) return;
    try {
      await unblockUserMutation.mutateAsync({ blockerId: memberId, blockedUserId: playerId });
      toast.success(`${displayName} has been unblocked.`);
    } catch (error) {
      logger.error('Error unblocking user', { error: errorText(error) });
      toast.error('Failed to unblock user. Please try again.');
    }
  };

  return {
    isBlocked,
    showBlockConfirm,
    setShowBlockConfirm,
    showUnblockConfirm,
    setShowUnblockConfirm,
    sendMessage,
    requestBlockToggle,
    confirmBlock,
    confirmUnblock,
  };
}
