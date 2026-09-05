/**
 * @fileoverview The "Premium features" checklist on the create-tournament page
 * (tournament paid foundation).
 *
 * A list of paid features (each a checkbox + blurb + preview price). Turning one
 * ON opens the verify/confirm popup (`PremiumFeatureDialog`); once confirmed the
 * row checks and its price joins the total. Turning one OFF is immediate (no
 * popup). A free tournament (just names) leaves all of these off — no payment.
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
import { PremiumFeatureDialog } from './PremiumFeatureDialog';
import type { CardOnFile } from '../useCreateBracketForm';

interface PremiumFeaturesSectionProps {
  /** Currently-checked feature keys. */
  selectedKeys: string[];
  /** The player's card on file (null → the popup collects one). */
  cardOnFile: CardOnFile | null;
  /** Saving / enabling in flight. */
  saving: boolean;
  /** Enable a feature — with card data first time, or reusing the card on file. */
  onEnable: (feature: PremiumFeature, card?: PaymentCardData) => void;
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
  const [pending, setPending] = useState<PremiumFeature | null>(null);
  const total = totalPriceCents(selectedKeys);

  const handleToggle = (feature: PremiumFeature, checked: boolean) => {
    if (checked) setPending(feature); // opens the verify/confirm popup
    else onDisable(feature.key);
  };

  const handleConfirm = (card?: PaymentCardData) => {
    if (pending) onEnable(pending, card);
    setPending(null);
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
              Due when you start{' '}
              <span className="text-muted-foreground">(preview pricing)</span>
            </span>
            <span className="font-semibold">
              {formatPrice(total)}
              {total >= PRICE_CAP_CENTS && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(max)</span>
              )}
            </span>
          </div>
          {cardOnFile && (
            <p className="text-xs text-muted-foreground">
              Card ending in {cardOnFile.last4} on file — not charged until you start.
            </p>
          )}
        </div>
      )}

      <PremiumFeatureDialog
        feature={pending}
        cardOnFile={cardOnFile}
        saving={saving}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
