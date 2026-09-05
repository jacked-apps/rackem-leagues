/**
 * @fileoverview The generic "set up a payment method" popup (tournament paid
 * foundation).
 *
 * Shown once, when the organizer turns on their FIRST premium feature and has no
 * card on file yet. It is deliberately GENERIC — it sets up the player's reusable
 * card, not a purchase of any one feature — and makes the no-charge-now promise
 * explicit: the card is only charged at checkout, when the tournament starts.
 * Once a card is established this dialog never reappears; enabling features is
 * then instant.
 */

import type { PaymentCardData } from '@/components/PaymentCardForm';
import { PaymentMethodSetup } from '@/components/PaymentMethodSetup';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface PaymentMethodDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Saving the card in flight. */
  saving: boolean;
  /** Card verified — hand back the card data + optional label to save + establish. */
  onVerified: (card: PaymentCardData, nickname?: string) => void;
  /** Dismiss without establishing a card. */
  onCancel: () => void;
}

export function PaymentMethodDialog({
  open,
  saving,
  onVerified,
  onCancel,
}: PaymentMethodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set up a payment method</DialogTitle>
          {/* Generic a11y description; the visible generic copy lives in PaymentMethodSetup. */}
          <DialogDescription className="sr-only">
            Add a payment card to keep on file.
          </DialogDescription>
        </DialogHeader>

        <PaymentMethodSetup
          saving={saving}
          chargeTiming={"You're charged only at checkout, when you start the tournament."}
          onVerified={onVerified}
        />
      </DialogContent>
    </Dialog>
  );
}
