/**
 * @fileoverview Confirmation Dialog Component
 *
 * Modal for confirming or denying opponent's score submissions.
 * Handles both normal score confirmations and vacate requests.
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

interface ConfirmationDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Game needing confirmation. The dialog is "dumb" — it renders each
   *  modifier that is truthy (or each non-null numeric field) regardless of
   *  which league or scoring system produced it. Caller passes the full
   *  match_games snapshot; the scoring dialog upstream is responsible for
   *  only letting relevant fields be set in the first place. */
  game: {
    gameNumber: number;
    winnerPlayerName: string;
    breakAndRun: boolean;
    goldenBreak: boolean;
    breakFouled: boolean;
    runout: boolean;
    winByForfeit: boolean;
    winnerValue: number | null;
    loserValue: number | null;
    isVacateRequest?: boolean;
  } | null;
  /** Game type for golden break label (8-ball, 9-ball, 10-ball, etc.) */
  gameType: string;
  /** Handler for confirm/agree button */
  onConfirm: (gameNumber: number, isVacateRequest?: boolean) => void;
  /** Handler for deny button */
  onDeny: (gameNumber: number, isVacateRequest?: boolean) => void;
  /**
   * Handler when the person dismisses WITHOUT confirming or denying — they tap
   * Cancel, the X, or press Escape. This is the "I didn't witness this / not
   * sure" escape hatch: it neither vouches (confirm) nor wipes (deny). The
   * caller suppresses re-prompting for this game for the rest of the session.
   * Distinct from `onClose`, which fires for every close (including after
   * confirm/deny). A dismiss always calls `onDismiss` then `onClose`.
   */
  onDismiss: (gameNumber: number) => void;
  /** Handler when dialog closes (after any of confirm / deny / dismiss). */
  onClose: () => void;
}

/**
 * Dialog for confirming opponent's game score or vacate request
 *
 * Two modes:
 * 1. Normal confirmation - opponent scored a game
 * 2. Vacate request - opponent wants to clear a game result
 */
export function ConfirmationDialog({
  open,
  game,
  gameType,
  onConfirm,
  onDeny,
  onDismiss,
  onClose,
}: ConfirmationDialogProps) {
  if (!game) return null;

  const isVacateRequest = game.isVacateRequest;

  // Get golden break label based on game type
  const getGoldenBreakLabel = () => {
    if (gameType === '8-ball') return 'an 8 on the Break!';
    if (gameType === '9-ball') return 'a 9 on the Break!';
    if (gameType === '10-ball') return 'a 10 on the Break!';
    return 'a Golden Break!';
  };

  const handleConfirm = () => {
    onConfirm(game.gameNumber, isVacateRequest);
    onClose();
  };

  const handleDeny = () => {
    onDeny(game.gameNumber, isVacateRequest);
    onClose();
  };

  // Dismiss without acting (Cancel button, the X, or Escape). Neither vouches
  // nor wipes — just closes and tells the caller to stop re-prompting this game
  // this session.
  const handleDismiss = () => {
    onDismiss(game.gameNumber);
    onClose();
  };

  return (
    // onOpenChange only fires for Radix-initiated closes (the X, Escape) — the
    // controlled `open` prop changing after confirm/deny does NOT trigger it,
    // so those paths don't double-dismiss. Outside-click stays prevented below
    // so a stray backdrop tap can't dismiss a consequential prompt.
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleDismiss(); }}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          {isVacateRequest ? (
            <>
              <DialogTitle className="text-orange-600">
                ⚠️ Confirm Vacate Winner
              </DialogTitle>
              <DialogDescription>
                Your opponent wants to vacate the winner and clear this game
                result.
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
            <>
              <p className="text-center text-foreground font-semibold">
                Game {game.gameNumber}
              </p>
              <div className="text-center text-lg font-semibold text-orange-600">
                Current winner: {game.winnerPlayerName}
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded p-3 mt-4">
                <p className="text-center text-sm text-foreground">
                  Agreeing will{' '}
                  <span className="font-semibold">vacate this winner</span> and
                  allow both teams to score this game again.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-muted-foreground text-sm">
                Opponent recorded for game {game.gameNumber}:
              </p>

              {/* Winner line — always shown. */}
              <div className="text-center text-lg font-semibold">
                {game.winnerPlayerName} won the game
              </div>

              {/* Modifiers — render each truthy flag on its own line so the
                  opponent sees every detail the scorer entered. Order runs
                  from most-celebratory to most-routine; presentation is
                  dumb and does not filter by league. */}
              <div className="text-center space-y-1 text-sm">
                {game.breakAndRun && (
                  <div className="text-blue-600 font-semibold">
                    Break &amp; Run
                  </div>
                )}
                {game.goldenBreak && (
                  <div className="text-green-600 font-semibold">
                    {getGoldenBreakLabel()}
                  </div>
                )}
                {game.runout && (
                  <div className="text-purple-600 font-semibold">
                    Runout after opponent&apos;s break
                  </div>
                )}
                {game.winByForfeit && (
                  <div className="text-foreground">Won by forfeit</div>
                )}
                {game.breakFouled && (
                  <div className="text-amber-700">
                    Break was fouled (re-rack with opposite breaker)
                  </div>
                )}
                {game.loserValue !== null && (
                  <div className="text-foreground">
                    Opponent pocketed{' '}
                    <span className="font-semibold">
                      {game.loserValue}
                    </span>{' '}
                    {game.loserValue === 1 ? 'ball' : 'balls'}
                  </div>
                )}
              </div>

              <p className="text-center mt-4 text-muted-foreground">
                Do you agree with this result?
              </p>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2">
          <div className="flex flex-row justify-around gap-4">
            <Button className="flex-1" onClick={handleConfirm} loadingText="Confirming...">
              {isVacateRequest ? 'Agree - Vacate Winner' : 'Confirm'}
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDeny} loadingText="none">
              {isVacateRequest ? 'Deny - Keep Winner' : 'Deny'}
            </Button>
          </div>
          {/* The neutral escape hatch — quieter than confirm/deny on purpose.
              For someone who isn't sure or didn't witness the game. */}
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleDismiss}
            loadingText="none"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
