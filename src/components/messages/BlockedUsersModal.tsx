/**
 * @fileoverview Blocked Users Management Modal
 *
 * Displays a list of users the current user has blocked with ability to unblock them.
 * Shows user information and when they were blocked.
 *
 * REFACTORED VERSION:
 * - Uses shared Modal component (DRY)
 * - Uses LoadingState component (DRY)
 * - Uses EmptyState component (DRY)
 * - Extracted BlockedUserItem component (Single Responsibility)
 * - Cleaner, more maintainable code
 */

import { UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal, LoadingState, EmptyState } from '@/components/shared';
import { useBlockedUsersDetails, useUnblockUser } from '@/api/hooks';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface BlockedUser {
  blocked_id: string;
  blocked_at: string;
  reason: string | null;
  blocked: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: number;
  };
}

interface BlockedUsersModalProps {
  currentUserId: string;
  onClose: () => void;
  onUnblocked?: () => void;
}

/**
 * Blocked User List Item Component
 * Single responsibility: Display one blocked user with unblock action
 */
function BlockedUserItem({
  blockedUser,
  onUnblock,
  isPending,
}: {
  blockedUser: BlockedUser;
  onUnblock: (id: string) => void;
  isPending: boolean;
}) {
  if (!blockedUser.blocked) return null;

  const user = blockedUser.blocked;
  const userName = `${user.first_name} ${user.last_name}`;
  const blockedDate = new Date(blockedUser.blocked_at).toLocaleDateString();

  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted transition-colors">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">{userName}</div>
        <div className="text-xs text-muted-foreground">
          Player #{user.system_player_number} • Blocked {blockedDate}
        </div>
        {blockedUser.reason && (
          <div className="text-xs text-muted-foreground mt-1">Reason: {blockedUser.reason}</div>
        )}
      </div>
      <Button
        onClick={() => onUnblock(blockedUser.blocked_id)}
        disabled={isPending}
        variant="outline"
        size="sm"
        className="ml-3 flex-shrink-0"
      >
        {isPending ? 'Unblocking...' : 'Unblock'}
      </Button>
    </div>
  );
}

/**
 * Main Modal Component
 * Responsibility: Orchestrate blocked users list and unblock actions
 */
export function BlockedUsersModal({
  currentUserId,
  onClose,
  onUnblocked,
}: BlockedUsersModalProps) {
  // TanStack Query hooks
  const { data: blockedUsersData = [], isLoading: loading } = useBlockedUsersDetails(currentUserId);
  const blockedUsers = blockedUsersData as any as BlockedUser[];
  const unblockMutation = useUnblockUser();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const handleUnblock = async (blockedUserId: string) => {
    const confirmed = await confirm({
      title: 'Unblock User?',
      message: 'Are you sure you want to unblock this user? They will be able to message you again.',
      confirmText: 'Unblock',
      confirmVariant: 'default',
    });
    if (!confirmed) return;

    unblockMutation.mutate(
      {
        blockerId: currentUserId,
        blockedUserId,
      },
      {
        onSuccess: () => {
          // Notify parent that list was updated
          onUnblocked?.();
        },
        onError: (error) => {
          logger.error('Error unblocking user', { error: error instanceof Error ? error.message : String(error) });
          toast.error('Failed to unblock user. Please try again.');
        },
      }
    );
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Blocked Users"
      icon={<UserX className="h-5 w-5 text-muted-foreground" />}
    >
      <Modal.Body>
        {loading ? (
          <LoadingState message="Loading blocked users..." />
        ) : blockedUsers.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="No Blocked Users"
            description="You haven't blocked anyone yet."
          />
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((blockedUser) => (
              <BlockedUserItem
                key={blockedUser.blocked_id}
                blockedUser={blockedUser}
                onUnblock={handleUnblock}
                isPending={unblockMutation.isPending}
              />
            ))}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={onClose} variant="outline">
          Close
        </Button>
      </Modal.Footer>

      {ConfirmDialogComponent}
    </Modal>
  );
}
