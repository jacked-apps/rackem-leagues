/**
 * @fileoverview RecordDuesModal Component
 *
 * Reusable modal component for recording or reversing membership dues payments.
 * Operators can use this to mark a player's dues as paid or reverse a payment.
 *
 * Usage:
 * <RecordDuesModal
 *   open={showModal}
 *   onOpenChange={setShowModal}
 *   playerId="uuid"
 *   playerName="John Doe"
 *   hasPaid={false}
 *   onSuccess={() => refetchData()}
 * />
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/shared';
import { queryKeys } from '@/api/queryKeys';
import { markMembershipPaid, updateMembershipPaidDate } from '@/api/queries/players';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface RecordDuesModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to control modal open state */
  onOpenChange: (open: boolean) => void;
  /** The player's member ID */
  playerId: string;
  /** The player's display name */
  playerName: string;
  /** Whether the player has already paid their dues */
  hasPaid: boolean;
  /** Optional callback fired after successful mutation */
  onSuccess?: () => void;
}

/**
 * Modal for recording or reversing membership dues payments.
 * Shows different confirmation dialogs based on current payment status.
 *
 * @example
 * // Mark dues as paid
 * <RecordDuesModal
 *   open={showDuesModal}
 *   onOpenChange={setShowDuesModal}
 *   playerId={player.id}
 *   playerName={player.name}
 *   hasPaid={false}
 * />
 *
 * @example
 * // Reverse a payment
 * <RecordDuesModal
 *   open={showDuesModal}
 *   onOpenChange={setShowDuesModal}
 *   playerId={player.id}
 *   playerName={player.name}
 *   hasPaid={true}
 * />
 */
export function RecordDuesModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  hasPaid,
  onSuccess,
}: RecordDuesModalProps) {
  const queryClient = useQueryClient();

  // Mark membership as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: (id: string) => markMembershipPaid(id),
    onSuccess: () => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.members.detail(playerId) });
      queryClient.invalidateQueries({ queryKey: ['playerDetails'] });
      queryClient.invalidateQueries({ queryKey: ['unauthorizedPlayers'] });
      queryClient.invalidateQueries({ queryKey: ['leagueDuesRoster'] });
      toast.success(`${playerName}'s membership marked as paid!`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      logger.error('Error marking membership as paid', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to update membership status. Please try again.');
    },
  });

  // Reverse membership mutation
  const reverseMembershipMutation = useMutation({
    mutationFn: (id: string) => updateMembershipPaidDate(id, null),
    onSuccess: () => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.members.detail(playerId) });
      queryClient.invalidateQueries({ queryKey: ['playerDetails'] });
      queryClient.invalidateQueries({ queryKey: ['unauthorizedPlayers'] });
      queryClient.invalidateQueries({ queryKey: ['leagueDuesRoster'] });
      toast.success(`${playerName}'s membership reversed!`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      logger.error('Error reversing membership', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to reverse membership. Please try again.');
    },
  });

  const handleConfirm = () => {
    if (hasPaid) {
      reverseMembershipMutation.mutate(playerId);
    } else {
      markPaidMutation.mutate(playerId);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={hasPaid ? 'Reverse Dues' : 'Mark Dues Paid'}
      description={
        hasPaid
          ? `Mark ${playerName}'s dues as unpaid for ${currentYear}.`
          : `Confirm that ${playerName} has paid their annual dues for ${currentYear}. Valid through December 31, ${currentYear}.`
      }
      confirmLabel={hasPaid ? 'Reverse' : 'Mark Paid'}
      cancelLabel="Cancel"
      onConfirm={handleConfirm}
      variant={hasPaid ? 'destructive' : 'default'}
    />
  );
}
