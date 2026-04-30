/**
 * @fileoverview Scoring Dialog Component
 *
 * Single-step confirmation dialog for scoring a game. The same component
 * drives all three scoring systems (BCA points, BCA percentage, Fargo) —
 * rendering is configurable: always-tracked flags, role-conditional
 * achievement buttons, and system-specific per-game inputs all render in
 * one Submit action.
 *
 * Field rules (Unit 11b):
 * - Break-fault toggle: always visible. When true, the actual breaker flips
 *   to the scheduled racker — so BR/GB and runout swap which side is
 *   eligible.
 * - Win-by-forfeit toggle: always visible.
 * - BR (Break & Run): visible when winner = actual breaker.
 * - GB (Golden Break / 8-on-the-break): visible when winner = actual breaker
 *   AND the league has `golden_break_counts_as_win = true`.
 * - Runout: visible when winner = non-breaker.
 * - Ball count (0–7): visible only when `handicapType === 'fargo'`. No
 *   default selection; Submit is disabled until a value is tapped (0 is a
 *   valid explicit choice).
 *
 * Winner points and loser points are NOT captured here — they derive at
 * read time from the league's snapshotted dials + the stored ball count.
 */

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface ScoringDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Game being scored */
  game: {
    gameNumber: number;
    winnerPlayerName: string;
    /**
     * True iff the clicked winner was the scheduled breaker for this game
     * (their side's action was 'breaks'). Combined with the break-fault
     * toggle to derive the actual breaker of the game-of-record.
     */
    winnerWasScheduledBreaker?: boolean;
  } | null;
  /** Break & Run checkbox state */
  breakAndRun: boolean;
  /** Golden Break checkbox state */
  goldenBreak: boolean;
  /** Whether league allows golden break to count as win */
  goldenBreakCountsAsWin: boolean;
  /** Game type for golden break label (8-ball, 9-ball, 10-ball, etc.) */
  gameType: string;
  /**
   * Resolved league handicap_type. When 'fargo', the ball-count input is
   * rendered and required before submit.
   */
  handicapType?: string;
  /** Break-fault toggle state (always visible). */
  breakFouled?: boolean;
  /** Win-by-forfeit toggle state (always visible). */
  winByForfeit?: boolean;
  /** Runout state (role-conditional on winner = non-breaker). */
  runout?: boolean;
  /** Loser balls pocketed 0–7 (Fargo only). null = unselected. */
  loserBallsPocketed?: number | null;
  /** Handler for Break & Run checkbox change */
  onBreakAndRunChange: (checked: boolean) => void;
  /** Handler for Golden Break checkbox change */
  onGoldenBreakChange: (checked: boolean) => void;
  /** Handler for break-fault toggle */
  onBreakFouledChange?: (checked: boolean) => void;
  /** Handler for win-by-forfeit toggle */
  onWinByForfeitChange?: (checked: boolean) => void;
  /** Handler for runout toggle */
  onRunoutChange?: (checked: boolean) => void;
  /** Handler for ball-count tap (Fargo only) */
  onLoserBallsPocketedChange?: (value: number) => void;
  /** Handler for cancel button */
  onCancel: () => void;
  /** Handler for confirm button */
  onConfirm: () => void;
}

/**
 * Dialog for scoring a game with special achievements.
 *
 * Break & Run and Golden Break are mutually exclusive.
 * When `handicapType === 'fargo'`, Submit is disabled until a ball count
 * has been tapped (0 is a valid explicit selection).
 */
export function ScoringDialog({
  open,
  game,
  breakAndRun,
  goldenBreak,
  goldenBreakCountsAsWin,
  gameType,
  handicapType = 'points',
  breakFouled = false,
  winByForfeit = false,
  runout = false,
  loserBallsPocketed = null,
  onBreakAndRunChange,
  onGoldenBreakChange,
  onBreakFouledChange,
  onWinByForfeitChange,
  onRunoutChange,
  onLoserBallsPocketedChange,
  onCancel,
  onConfirm,
}: ScoringDialogProps) {
  if (!game) return null;

  // Derive the actual breaker role of the game-of-record. A break foul
  // means the scheduled racker breaks again (re-rack), so role flips.
  const winnerWasScheduledBreaker = game.winnerWasScheduledBreaker ?? true;
  const winnerIsActualBreaker = winnerWasScheduledBreaker !== breakFouled;

  const isFargo = handicapType === 'fargo';

  // Submit is blocked when Fargo matches don't yet have a ball count selected.
  // Ball count can be 0 (valid choice), so we test for null explicitly.
  const fargoBallCountMissing = isFargo && loserBallsPocketed === null;

  // Get label for golden break based on game type
  const getGoldenBreakLabel = () => {
    if (gameType === '8-ball') return '8 on the Break';
    if (gameType === '9-ball') return '9 on the Break';
    if (gameType === '10-ball') return '10 on the Break';
    return 'Golden Break';
  };

  // When the user toggles break-fault, the eligible achievement flips. Any
  // previously-ticked achievement that's no longer applicable gets cleared
  // so submit doesn't persist an inconsistent state.
  const handleBreakFouledChange = (checked: boolean) => {
    onBreakFouledChange?.(checked);
    // The new actual-breaker role after the toggle.
    const newWinnerIsActualBreaker = winnerWasScheduledBreaker !== checked;
    if (newWinnerIsActualBreaker) {
      // Winner is now a breaker — runout no longer applies.
      if (runout) onRunoutChange?.(false);
    } else {
      // Winner is now a non-breaker — BR/GB no longer apply.
      if (breakAndRun) onBreakAndRunChange(false);
      if (goldenBreak) onGoldenBreakChange(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Select Game Winner</DialogTitle>
          <DialogDescription>
            Select any special achievements for this game.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Game {game.gameNumber}</p>
            <p className="text-lg font-semibold mt-2">
              Winner: {game.winnerPlayerName}
            </p>
          </div>

          {/* Always-tracked toggles */}
          <div className="flex items-center justify-between">
            <Label htmlFor="breakFouled" className="text-sm font-normal">
              Break foul (re-rack)
            </Label>
            <Switch
              id="breakFouled"
              checked={breakFouled}
              onCheckedChange={handleBreakFouledChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="winByForfeit" className="text-sm font-normal">
              Win by forfeit
            </Label>
            <Switch
              id="winByForfeit"
              checked={winByForfeit}
              onCheckedChange={(checked) => onWinByForfeitChange?.(checked)}
            />
          </div>

          {/* Role-conditional achievements */}
          {winnerIsActualBreaker && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="breakAndRun"
                checked={breakAndRun}
                onChange={(e) => {
                  onBreakAndRunChange(e.target.checked);
                  if (e.target.checked) onGoldenBreakChange(false);
                }}
                className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
              />
              <label
                htmlFor="breakAndRun"
                className="text-sm font-normal cursor-pointer"
              >
                Break &amp; Run
              </label>
            </div>
          )}

          {winnerIsActualBreaker && goldenBreakCountsAsWin && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="goldenBreak"
                checked={goldenBreak}
                onChange={(e) => {
                  onGoldenBreakChange(e.target.checked);
                  if (e.target.checked) onBreakAndRunChange(false);
                }}
                className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
              />
              <label
                htmlFor="goldenBreak"
                className="text-sm font-normal cursor-pointer"
              >
                {getGoldenBreakLabel()}
              </label>
            </div>
          )}

          {!winnerIsActualBreaker && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="runout"
                checked={runout}
                onChange={(e) => onRunoutChange?.(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
              />
              <label
                htmlFor="runout"
                className="text-sm font-normal cursor-pointer"
              >
                Runout
              </label>
            </div>
          )}

          {/* Fargo-only: loser balls pocketed (0–7) */}
          {isFargo && (
            <div className="space-y-2">
              <Label className="text-sm font-normal">
                Loser balls pocketed
              </Label>
              <div className="grid grid-cols-8 gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
                  const selected = loserBallsPocketed === n;
                  return (
                    <Button
                      key={n}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => onLoserBallsPocketedChange?.(n)}
                      loadingText="none"
                    >
                      {n}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} loadingText="none">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            loadingText="Saving..."
            disabled={fargoBallCountMissing}
          >
            Select Winner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
