/**
 * @fileoverview Edit Game Dialog Component
 *
 * Modal for vacating a game winner to allow re-scoring.
 * Tracks vacate requests and prevents duplicate requests.
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface EditGameDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Game being edited */
  game: {
    gameNumber: number;
    winnerPlayerName: string;
    gameId: string;
  } | null;
  /** Set of game numbers user has requested vacate for */
  myVacateRequests: Set<number>;
  /** Handler for vacate request - passes gameNumber and gameId */
  onVacate: (gameNumber: number, gameId: string) => Promise<void>;
  /** Handler when dialog closes */
  onClose: () => void;
}

/**
 * Dialog for requesting to vacate a game winner
 *
 * Allows user to request clearing a confirmed game result.
 * Prevents duplicate requests by checking myVacateRequests set.
 * Other team must confirm the vacate request before it takes effect.
 */
export function EditGameDialog({
  open,
  game,
  myVacateRequests,
  onVacate,
  onClose,
}: EditGameDialogProps) {
  if (!game) return null;

  const hasRequested = myVacateRequests.has(game.gameNumber);

  const handleVacate = async () => {
    await onVacate(game.gameNumber, game.gameId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Game {game.gameNumber}</DialogTitle>
          <DialogDescription>
            Request to vacate the winner and clear this game result.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="text-center">
            <p className="text-foreground font-semibold mb-2">
              Current winner: {game.winnerPlayerName}
            </p>
            {hasRequested ? (
              <div className="bg-warning/10 border border-warning/40 rounded p-3">
                <p className="text-sm text-foreground">
                  You have already requested to vacate this winner. Waiting for
                  opponent confirmation.
                </p>
              </div>
            ) : (
              <div className="bg-warning/10 border border-warning/40 rounded p-3">
                <p className="text-sm text-foreground">
                  Requesting to vacate will notify your opponent. Both teams
                  must agree before the winner can be cleared and re-scored.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-around gap-4">
          {!hasRequested && (
            <Button className="flex-1" onClick={handleVacate} loadingText="Requesting...">
              Request Vacate Winner
            </Button>
          )}
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            loadingText="none"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
