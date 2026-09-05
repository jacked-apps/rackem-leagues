/**
 * @fileoverview PaymentMethodSetup — the reusable "set up a card on file" panel.
 *
 * Wraps the low-level `PaymentCardForm` with the consistent app-wide framing for
 * *establishing* a reusable payment method: an explicit "we are NOT charging you
 * now — only when {chargeTiming}" reassurance, then the card form. On success it
 * hands back the verified card data for the caller to persist.
 *
 * Reusable anywhere a card is set up on file — the tournament paid flow uses it
 * inside a dialog; the League Operator application should adopt it too (it
 * currently wires `PaymentCardForm` + reducer inline). See LIST_FOR_ED.md.
 *
 * This component only VERIFIES + returns the card (no charge, no persistence);
 * where the card is stored (payment_methods, org, ...) is the caller's job.
 */

import { PaymentCardForm, type PaymentCardData } from './PaymentCardForm';

export interface PaymentMethodSetupProps {
  /** Card verified — hand back the data to save it. */
  onVerified: (card: PaymentCardData) => void;
  /** Saving the card in flight (disables the form). */
  saving?: boolean;
  /**
   * Completes the no-charge-now reassurance: "you're {chargeTiming}." Keep it
   * specific so the user knows exactly when money moves (e.g. "charged only at
   * checkout, when you start the tournament").
   */
  chargeTiming?: string;
  /** Verify button text (default "Verify card"). */
  verifyButtonText?: string;
}

export function PaymentMethodSetup({
  onVerified,
  saving = false,
  chargeTiming = 'charged only when you complete your purchase',
  verifyButtonText = 'Verify card',
}: PaymentMethodSetupProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm font-medium text-success">
        We are <span className="underline">not</span> charging your card now — you&apos;re{' '}
        {chargeTiming}.
      </div>

      <PaymentCardForm
        loading={saving}
        verifyButtonText={verifyButtonText}
        onVerificationSuccess={onVerified}
      />
    </div>
  );
}
