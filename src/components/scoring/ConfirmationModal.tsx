/**
 * @fileoverview Confirmation Modal Component
 *
 * Modal for confirming opponent's score or vacate request.
 * Shows different UI based on whether it's a normal score or vacate request.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmationModalProps {
  isOpen: boolean;
  gameNumber: number;
  winnerPlayerName: string;
  breakAndRun: boolean;
  goldenBreak: boolean;
  isVacateRequest?: boolean;
  gameType?: string; // '8-ball', '9-ball', '10-ball', etc.
  onAccept: () => void;
  onDeny: () => void;
}

/**
 * Modal for confirming opponent's score or vacate request
 *
 * Two modes:
 * 1. Normal confirmation: Shows winner name and any special achievements (B&R, Golden Break)
 * 2. Vacate request: Shows current winner and asks to confirm vacating the result
 */
export function ConfirmationModal({
  isOpen,
  gameNumber,
  winnerPlayerName,
  breakAndRun,
  goldenBreak,
  isVacateRequest = false,
  gameType = '8-ball',
  onAccept,
  onDeny,
}: ConfirmationModalProps) {
  /**
   * Get Golden Break label based on game type
   */
  const getGoldenBreakLabel = () => {
    if (gameType === '8-ball') return 'an 8 on the Break!';
    if (gameType === '9-ball') return 'a 9 on the Break!';
    if (gameType === '10-ball') return 'a 10 on the Break!';
    return 'a Golden Break!';
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          {isVacateRequest ? (
            <>
              <DialogTitle className="text-warning">⚠️ Confirm Vacate Winner</DialogTitle>
              <DialogDescription>
                Your opponent wants to vacate the winner and clear this game result.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>Confirm Opponent's Score</DialogTitle>
              <DialogDescription>
                Verify the game result submitted by your opponent.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isVacateRequest ? (
            // Vacate request mode
            <>
              <p className="text-center text-foreground font-semibold">
                Game {gameNumber}
              </p>
              <div className="text-center text-lg font-semibold text-warning">
                Current winner: {winnerPlayerName}
              </div>
              <div className="bg-warning/10 border border-warning/40 rounded p-3 mt-4">
                <p className="text-center text-sm text-foreground">
                  Agreeing will <span className="font-semibold">vacate this winner</span> and allow both teams to score this game again.
                </p>
              </div>
            </>
          ) : (
            // Normal confirmation mode
            <>
              <p className="text-center text-muted-foreground text-sm">
                Opponent recorded for game {gameNumber}:
              </p>
              {/* Dynamic result message based on what was selected */}
              <div className="text-center text-lg font-semibold">
                {breakAndRun ? (
                  <div className="text-info">
                    {winnerPlayerName} had a Break & Run!
                  </div>
                ) : goldenBreak ? (
                  <div className="text-success">
                    {winnerPlayerName} had {getGoldenBreakLabel()}
                  </div>
                ) : (
                  <div>
                    {winnerPlayerName} won the game
                  </div>
                )}
              </div>
              <p className="text-center mt-4 text-muted-foreground">
                Do you agree with this result?
              </p>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-row justify-around gap-4">
          <Button
            className="flex-1"
            onClick={onAccept}
            loadingText="Confirming..."
          >
            {isVacateRequest ? 'Agree - Vacate Winner' : 'Yes - Confirm'}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onDeny}
            loadingText="Denying..."
          >
            {isVacateRequest ? 'Deny - Keep Winner' : 'No - Deny'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
