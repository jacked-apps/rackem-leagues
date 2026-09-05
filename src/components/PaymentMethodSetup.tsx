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

import { useState } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { InfoButton } from './InfoButton';
import { PaymentCardForm, type PaymentCardData } from './PaymentCardForm';

export interface PaymentMethodSetupProps {
  /**
   * Card verified — hand back the data plus the optional player-given label
   * (a card nickname, e.g. "Personal Visa") for the caller to save.
   */
  onVerified: (card: PaymentCardData, nickname?: string) => void;
  /** Saving the card in flight (disables the form). */
  saving?: boolean;
  /**
   * OPTIONAL caller-specific clause appended after "We are not charging your card
   * now." so the user knows exactly when money moves in THIS context — e.g. the
   * tournament flow passes "You're charged only at checkout, when you start the
   * tournament." Omit it for a purely generic setup. The component stays
   * domain-neutral: no mention of tournaments, dues, features, etc.
   */
  chargeTiming?: string;
  /** Verify button text (default "Verify card"). */
  verifyButtonText?: string;
}

export function PaymentMethodSetup({
  onVerified,
  saving = false,
  chargeTiming,
  verifyButtonText = 'Verify card',
}: PaymentMethodSetupProps) {
  const [nickname, setNickname] = useState('');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add a card to keep on file — you only enter it once, and it&apos;s reusable
        for anything you pay for.
      </p>

      <div className="flex items-start justify-between gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm font-medium text-success">
        <span>
          We are <span className="underline">not</span> charging your card now.
          {chargeTiming ? ` ${chargeTiming}` : ''}
        </span>
        <InfoButton title="Is my card safe?" size="sm" align="right">
          <div className="space-y-2">
            <p>
              Your card number is <strong>never saved on our site.</strong>
            </p>
            <p>
              When you add a card, it goes straight to our payment company — the
              same kind of company banks use — and they hand us back a private key,
              not your actual card number. We use that key to charge you only when
              you okay a purchase.
            </p>
            <p>
              So even if someone broke into our site, there&apos;s no card number
              here to steal. And you only enter it once — it stays ready for next
              time.
            </p>
          </div>
        </InfoButton>
      </div>

      <div className="space-y-1">
        <Label htmlFor="card-nickname">Card name (optional)</Label>
        <Input
          id="card-nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. Personal Visa"
          maxLength={40}
        />
      </div>

      <PaymentCardForm
        loading={saving}
        verifyButtonText={verifyButtonText}
        onVerificationSuccess={(card) => onVerified(card, nickname.trim() || undefined)}
      />
    </div>
  );
}
