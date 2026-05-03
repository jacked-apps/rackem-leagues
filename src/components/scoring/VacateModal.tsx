/**
 * @fileoverview Vacate Modal Component
 *
 * Modal for initiating a vacate request on a confirmed game.
 * Asks opponent to agree to clear the result and allow both teams to score again.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface VacateModalProps {
  isOpen: boolean;
  gameNumber: number;
  currentWinnerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal for vacating a confirmed game winner
 *
 * Initiates a request to opponent to agree to vacate the winner.
 * If opponent agrees, the game result is cleared and both teams can score again.
 */
export function VacateModal({
  isOpen,
  gameNumber,
  currentWinnerName,
  onConfirm,
  onCancel,
}: VacateModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Vacate Winner - Game {gameNumber}</DialogTitle>
          <DialogDescription>
            Request to clear the result and allow both teams to score again.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Current winner: <span className="font-semibold">{currentWinnerName}</span>
          </p>

          <p className="text-center text-sm text-muted-foreground">
            This will request your opponent to agree to vacate this result so both teams can score it again.
          </p>
        </div>

        <DialogFooter className="flex flex-row justify-around gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            loadingText="none"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={onConfirm}
            loadingText="none"
          >
            Request Vacate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
