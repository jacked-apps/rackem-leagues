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
import { getGameEvent } from '@/systems/game-events';
import type { ConfirmationQueueItem } from '@/types/match';

interface ConfirmationDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Game needing confirmation. The dialog is "dumb" — it renders one badge
   *  per recorded event using the registry's label, plus the numeric
   *  per-side values (loserValue, winnerValue) and the break_fouled state
   *  modifier. Caller is responsible for fetching events from game_events
   *  and passing the array; this dialog never queries the database. */
  game: ConfirmationQueueItem | null;
  /** Game type for golden break label (8-ball, 9-ball, 10-ball, etc.) */
  gameType: string;
  /** Handler for confirm/agree button */
  onConfirm: (gameNumber: number, isResetRequest?: boolean) => void;
  /** Handler for deny button */
  onDeny: (gameNumber: number, isResetRequest?: boolean) => void;
  /** Handler when dialog closes */
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
  onClose,
}: ConfirmationDialogProps) {
  if (!game) return null;

  const isVacateRequest = game.isResetRequest;

  // Get game-type-specific golden_break label.
  const getGoldenBreakLabel = () => {
    if (gameType === '8-ball' || gameType === 'eight_ball') return 'an 8 on the Break!';
    if (gameType === '9-ball' || gameType === 'nine_ball') return 'a 9 on the Break!';
    if (gameType === '10-ball' || gameType === 'ten_ball') return 'a 10 on the Break!';
    return 'a Golden Break!';
  };

  // Branch B Phase 1: render one row per recorded event using registry label.
  // Two events have special display copy preserved from before the rewrite
  // (golden_break gets the game-type-specific phrasing; runout gets the
  // "after opponent's break" suffix). All others fall back to the registry
  // label as-is.
  const renderEventLabel = (eventName: string): { text: string; className: string } => {
    if (eventName === 'golden_break') {
      return { text: getGoldenBreakLabel(), className: 'text-green-600 font-semibold' };
    }
    if (eventName === 'break_and_run') {
      return { text: 'Break & Run', className: 'text-blue-600 font-semibold' };
    }
    if (eventName === 'runout') {
      return { text: "Runout after opponent's break", className: 'text-purple-600 font-semibold' };
    }
    if (eventName === 'win_by_forfeit') {
      return { text: 'Won by forfeit', className: 'text-foreground' };
    }
    // Registry-driven fallback (covers Phase 2 LO-toggleable events like
    // early_8, scratch_on_8, eight_wrong_pocket once they're enabled).
    const definition = getGameEvent(eventName);
    return { text: definition?.label ?? eventName, className: 'text-foreground' };
  };

  const handleConfirm = () => {
    onConfirm(game.gameNumber, isVacateRequest);
    onClose();
  };

  const handleDeny = () => {
    onDeny(game.gameNumber, isVacateRequest);
    onClose();
  };

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
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

              {/* Events + state modifiers — render one row per registry event
                  the scorer recorded, plus the break-fault state modifier and
                  the loser's per-game value (calculator-driven). Branch B
                  Phase 1 reads from the events array (sourced from game_events
                  by the caller); the dialog itself stays "dumb." */}
              <div className="text-center space-y-1 text-sm">
                {game.events
                  // break_fouled is shown via its dedicated row below for the
                  // longer "(re-rack with opposite breaker)" copy; skip it here.
                  .filter(eventName => eventName !== 'break_fouled')
                  .map(eventName => {
                    const { text, className } = renderEventLabel(eventName);
                    return (
                      <div key={eventName} className={className}>
                        {text}
                      </div>
                    );
                  })}
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

        <DialogFooter className="flex flex-row justify-around gap-4">
          <Button className="flex-1" onClick={handleConfirm} loadingText="Confirming...">
            {isVacateRequest ? 'Agree - Vacate Winner' : 'Confirm'}
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleDeny} loadingText="none">
            {isVacateRequest ? 'Deny - Keep Winner' : 'Deny'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
