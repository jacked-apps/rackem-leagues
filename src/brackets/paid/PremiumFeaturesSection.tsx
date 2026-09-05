/**
 * @fileoverview The "Premium features" checklist on the create-tournament page
 * (tournament paid foundation).
 *
 * A list of paid features (each a checkbox + blurb + $1 price). Turning one ON:
 * if the player has no card on file yet, the generic "set up a payment method"
 * popup appears first (once); once a card is established, turning features on/off
 * is instant. A free tournament (just names) leaves all of these off — no payment.
 *
 * Presentational: card-saving + feature state live in the orchestrator, reached
 * via onEnable / onDisable.
 */

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { PaymentCardData } from '@/components/PaymentCardForm';
import {
  PREMIUM_FEATURES,
  PRICE_CAP_CENTS,
  formatPrice,
  totalPriceCents,
  type PremiumFeature,
} from './premiumFeatures';
import { PaymentMethodDialog } from './PaymentMethodDialog';
import type { CardOnFile } from '../useCreateBracketForm';

interface PremiumFeaturesSectionProps {
  /** Currently-checked feature keys. */
  selectedKeys: string[];
  /** The player's card on file (null → a card is set up before the first feature). */
  cardOnFile: CardOnFile | null;
  /** Saving / enabling in flight. */
  saving: boolean;
  /** Enable a feature — with card data + optional label (first-time setup) or reusing the card on file. */
  onEnable: (feature: PremiumFeature, card?: PaymentCardData, nickname?: string) => void;
  /** Disable a feature (immediate, no popup). */
  onDisable: (key: string) => void;
}

export function PremiumFeaturesSection({
  selectedKeys,
  cardOnFile,
  saving,
  onEnable,
  onDisable,
}: PremiumFeaturesSectionProps) {
  // The feature the organizer is turning on while the payment-method popup is open.
  const [pendingFeature, setPendingFeature] = useState<PremiumFeature | null>(null);
  const total = totalPriceCents(selectedKeys);

  const handleToggle = (feature: PremiumFeature, checked: boolean) => {
    if (!checked) {
      onDisable(feature.key);
      return;
    }
    if (cardOnFile) {
      // Payment method already established — enable straight away, no popup.
      onEnable(feature);
    } else {
      // No card yet — set one up first (generic), then enable this feature.
      setPendingFeature(feature);
    }
  };

  const handleVerified = (card: PaymentCardData, nickname?: string) => {
    if (pendingFeature) onEnable(pendingFeature, card, nickname);
    setPendingFeature(null);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Premium features</Label>
        <p className="text-sm text-muted-foreground">
          Turn these on to run a smarter tournament — <span className="font-medium">$1 each,
          or turn everything on for {formatPrice(PRICE_CAP_CENTS)}</span>. A free tournament —
          just names — needs none of them.
        </p>
      </div>

      {/* Payment-method status — so the organizer (and the flow) know a card is set up. */}
      {cardOnFile && (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <span aria-hidden>✓</span>
          Payment method established —{' '}
          {cardOnFile.nickname ? `${cardOnFile.nickname} · ` : ''}
          {cardOnFile.brand} ending in {cardOnFile.last4}.
        </p>
      )}

      <ul className="space-y-2">
        {PREMIUM_FEATURES.map((f) => {
          const checked = selectedKeys.includes(f.key);
          return (
            <li key={f.key} className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id={`pf-${f.key}`}
                checked={checked}
                onCheckedChange={(c) => handleToggle(f, c === true)}
                className="mt-1"
              />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`pf-${f.key}`} className="cursor-pointer">
                    {f.label}
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {formatPrice(f.priceCents)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{f.blurb}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between rounded-md bg-muted p-3">
            <span className="text-sm">
              Due at checkout{' '}
              <span className="text-muted-foreground">(preview pricing)</span>
            </span>
            <span className="font-semibold">
              {formatPrice(total)}
              {total >= PRICE_CAP_CENTS && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(max)</span>
              )}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Not charged now — only when you start the tournament.
          </p>
        </div>
      )}

      <PaymentMethodDialog
        open={pendingFeature !== null}
        saving={saving}
        onVerified={handleVerified}
        onCancel={() => setPendingFeature(null)}
      />
    </div>
  );
}
