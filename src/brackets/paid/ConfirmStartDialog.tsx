/**
 * @fileoverview The final look before money moves (Unit C3).
 *
 * Start does two irreversible things at once — it draws a bracket that can't be
 * redrawn, and it charges a card. So the last tap before both is a deliberate
 * one, showing the two facts the organizer would want to check: how many
 * players are actually going in, and exactly what they are being charged.
 *
 * The player count here is the FINAL one, after any waiting-list decision, so
 * it can differ from what the card behind the dialog said a moment ago. That's
 * the point — it confirms the tournament they're about to run, not the one they
 * were looking at.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChargeReceipt } from './ChargeReceipt';

interface ConfirmStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many players will actually be in the bracket. */
  playerCount: number;
  /** `brackets.premium_features` — drives the receipt. */
  featureKeys: readonly string[];
  /** e.g. "$2.00", or null when nothing is being charged. */
  priceLabel: string | null;
  onConfirm: () => void;
}

export function ConfirmStartDialog({
  open,
  onOpenChange,
  playerCount,
  featureKeys,
  priceLabel,
  onConfirm,
}: ConfirmStartDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start with {playerCount} players?</AlertDialogTitle>
          <AlertDialogDescription>
            This draws the bracket{priceLabel ? ' and charges your card' : ''}. The
            bracket can't be redrawn afterwards.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {priceLabel && (
          <div className="rounded-md border p-3">
            <ChargeReceipt featureKeys={featureKeys} />
          </div>
        )}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="mt-0">Go back</AlertDialogCancel>
          {/* Says the amount, so nobody taps a bare "Confirm" into a charge. */}
          <AlertDialogAction onClick={onConfirm}>
            {priceLabel ? `Pay ${priceLabel} and start` : 'Start tournament'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
