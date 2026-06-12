/**
 * @fileoverview Lineup Change Request Modal Component
 *
 * Modal shown to the opposing team when a lineup change has been requested.
 * Displays the proposed swap and allows approve/deny.
 *
 * Similar pattern to game confirmation dialogs.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface LineupChangeRequestModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Team name requesting the change */
  requestingTeamName: string;
  /** Position being changed (1-5) */
  position: number;
  /** Name of player being replaced */
  oldPlayerName: string;
  /** Handicap of the player being replaced (shown so the approver sees the swing). */
  oldPlayerHandicap?: number | null;
  /** Name of replacement player */
  newPlayerName: string;
  /** Handicap of the replacement player. */
  newPlayerHandicap?: number | null;
  /** Handler when user approves the change */
  onApprove: () => void;
  /** Handler when user denies the change */
  onDeny: () => void;
  /** Whether an action is in progress */
  isProcessing?: boolean;
}

/**
 * Modal for opponent to approve/deny a lineup change request
 */
/** Format a handicap value for display ("HC 2", "HC -1", or "HC —"). */
function formatHandicap(value?: number | null): string {
  return value == null ? 'HC —' : `HC ${value}`;
}

export function LineupChangeRequestModal({
  isOpen,
  requestingTeamName,
  position,
  oldPlayerName,
  oldPlayerHandicap,
  newPlayerName,
  newPlayerHandicap,
  onApprove,
  onDeny,
  isProcessing = false,
}: LineupChangeRequestModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Lineup Change Request</DialogTitle>
          <DialogDescription>
            {requestingTeamName} is requesting a lineup change
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Position info */}
          <div className="text-center text-sm text-muted-foreground">
            Position {position}
          </div>

          {/* Swap visualization */}
          <div className="flex items-center justify-center gap-4 py-4">
            {/* Old player */}
            <div className="text-center p-3 bg-destructive/10 rounded-lg border border-destructive/40 min-w-[100px]">
              <p className="text-xs text-destructive mb-1">Removing</p>
              <p className="font-semibold text-foreground">{oldPlayerName}</p>
              <p className="text-xs font-medium text-destructive mt-1">{formatHandicap(oldPlayerHandicap)}</p>
            </div>

            {/* Arrow */}
            <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />

            {/* New player */}
            <div className="text-center p-3 bg-success/10 rounded-lg border border-success/40 min-w-[100px]">
              <p className="text-xs text-success mb-1">Adding</p>
              <p className="font-semibold text-foreground">{newPlayerName}</p>
              <p className="text-xs font-medium text-success mt-1">{formatHandicap(newPlayerHandicap)}</p>
            </div>
          </div>

          {/* Info text */}
          <p className="text-xs text-muted-foreground text-center">
            If you approve, the lineup will be updated immediately.
          </p>
        </div>

        <DialogFooter className="flex flex-row justify-around gap-4">
          <Button
            variant="outline"
            className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={onDeny}
            disabled={isProcessing}
          >
            Deny
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={onApprove}
            disabled={isProcessing}
            isLoading={isProcessing}
            loadingText="Processing..."
          >
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
