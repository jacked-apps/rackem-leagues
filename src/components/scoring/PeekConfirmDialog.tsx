/**
 * @fileoverview Peek-and-confirm dialog for fully-confirmed games
 * (many-eyes Layer-2 / Unit 6).
 *
 * Opened when a viewer taps a confirmed-state row in `GamesList`. Shows the
 * full recorded result (winner + achievements + points) plus two actions:
 *
 *   - **Confirm** — append my vouch row as an extra witness (calls
 *     `confirmOpponentScore` under the hood, which Amendment I gates with the
 *     3-step check; the officiality column write no-ops via `.is(null)` since
 *     it's already set; the audit row appends regardless).
 *   - **Close** — just close the dialog. No data effect.
 *
 * No Deny action by design — disagreeing with an already-official game is the
 * vacate-and-rescore path, not this dialog. If a user already personally
 * vouched, the Confirm button hides (their tap would be a no-op via the
 * append helper's no-exact-dup guard, but the UI shouldn't pretend it's an
 * available action).
 *
 * Visual: shadcn `Dialog`. Result rendering mirrors the `<DissentFlag>` and
 * `<DisputeDetailModal>` cards for consistency.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ResultLike } from '@/utils/match/deriveDissents';

// ── Copy (editable; lives in constants so iteration is one-line) ──────────
const TITLE = (gameNumber: number) => `Game ${gameNumber} — recorded result`;
const DESCRIPTION =
  'This game is fully scored. Review the details and add your vouch as an extra witness, or close.';
const ALREADY_VOUCHED_NOTE = 'You have already vouched for this game.';
const CONFIRM_LABEL = 'Confirm';

export interface PeekConfirmDialogProps {
  /** 1-based game number; null when closed. */
  gameNumber: number | null;
  /** Resolved display name for the winner. */
  winnerPlayerName: string;
  /** The currently-recorded official result (read from `match_games`). */
  recordedResult: ResultLike;
  /** True if the current viewer has already vouched for this game. Hides Confirm. */
  alreadyVouched: boolean;
  /** Controlled open-change handler (Radix Dialog pattern). */
  onOpenChange: (open: boolean) => void;
  /** Fires on Confirm tap — caller calls the actual mutation. */
  onConfirm: () => void;
}

/** Same achievements helper as the dispute/dissent UI for visual consistency. */
function formatAchievements(r: ResultLike): string {
  const parts: string[] = [];
  if (r.break_and_run) parts.push('Break & Run');
  if (r.golden_break) parts.push('Golden Break');
  if (r.break_fouled) parts.push('Break Fouled');
  if (r.runout) parts.push('Runout');
  if (r.win_by_forfeit) parts.push('Forfeit');
  return parts.join(', ');
}

export function PeekConfirmDialog({
  gameNumber,
  winnerPlayerName,
  recordedResult,
  alreadyVouched,
  onOpenChange,
  onConfirm,
}: PeekConfirmDialogProps) {
  const open = gameNumber !== null;
  const achievements = formatAchievements(recordedResult);
  const hasPoints =
    recordedResult.winner_value != null || recordedResult.loser_value != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {gameNumber !== null && (
          <>
            <DialogHeader>
              <DialogTitle>{TITLE(gameNumber)}</DialogTitle>
              <DialogDescription>{DESCRIPTION}</DialogDescription>
            </DialogHeader>

            <div className="rounded-md border p-3 text-sm">
              <dl className="space-y-1">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Winner:</dt>
                  <dd className="font-medium">{winnerPlayerName}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Achievements:</dt>
                  <dd>
                    {achievements || (
                      <em className="text-muted-foreground">none</em>
                    )}
                  </dd>
                </div>
                {hasPoints && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Points:</dt>
                    <dd>
                      W: {recordedResult.winner_value ?? '—'}
                      {'  '}L: {recordedResult.loser_value ?? '—'}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {alreadyVouched && (
              <p className="text-sm text-muted-foreground">
                {ALREADY_VOUCHED_NOTE}
              </p>
            )}

            {!alreadyVouched && (
              <DialogFooter>
                {/* Confirm is the primary action; close paths are the shadcn
                    Dialog's built-in X icon + ESC + outside-click (same
                    pattern as DisputeDetailModal — no redundant footer
                    Close button). */}
                <Button
                  variant="default"
                  loadingText="none"
                  onClick={onConfirm}
                >
                  {CONFIRM_LABEL}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
