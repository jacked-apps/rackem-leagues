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
import { InfoButton } from '@/components/InfoButton';
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
  /** Enable ALL features ("Everything for $5") — with card data or reusing the card on file. */
  onEnableAll: (card?: PaymentCardData, nickname?: string) => void;
  /** Clear all features. */
  onDisableAll: () => void;
}

/** What the payment popup will do once a card is set up. */
type Pending = { kind: 'feature'; feature: PremiumFeature } | { kind: 'all' } | null;

export function PremiumFeaturesSection({
  selectedKeys,
  cardOnFile,
  saving,
  onEnable,
  onDisable,
  onEnableAll,
  onDisableAll,
}: PremiumFeaturesSectionProps) {
  // What the organizer is turning on while the payment-method popup is open.
  const [pending, setPending] = useState<Pending>(null);
  const total = totalPriceCents(selectedKeys);
  const allSelected = selectedKeys.length === PREMIUM_FEATURES.length;

  /** Enable-path helper: reuse the card on file, or open the setup popup first. */
  const enableOrSetUp = (pendingAction: Pending, enableNow: () => void) => {
    if (cardOnFile) enableNow();
    else setPending(pendingAction);
  };

  const handleToggle = (feature: PremiumFeature, checked: boolean) => {
    if (!checked) onDisable(feature.key);
    else enableOrSetUp({ kind: 'feature', feature }, () => onEnable(feature));
  };

  const handleToggleAll = (checked: boolean) => {
    if (!checked) onDisableAll();
    else enableOrSetUp({ kind: 'all' }, () => onEnableAll());
  };

  const handleVerified = (card: PaymentCardData, nickname?: string) => {
    if (pending?.kind === 'feature') onEnable(pending.feature, card, nickname);
    else if (pending?.kind === 'all') onEnableAll(card, nickname);
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

      {/* Payment-method status — so the organizer (and the flow) know a card is set up. */}
      {cardOnFile && (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <span aria-hidden>✓</span>
          Payment method established —{' '}
          {cardOnFile.nickname ? `${cardOnFile.nickname} · ` : ''}
          {cardOnFile.brand} ending in {cardOnFile.last4}.
        </p>
      )}

      {/* The deal: everything for $5, however many $1 features there are. */}
      <label
        htmlFor="pf-all"
        className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-primary/50 bg-primary/5 p-3"
      >
        <Checkbox
          id="pf-all"
          checked={allSelected}
          onCheckedChange={(c) => handleToggleAll(c === true)}
        />
        <div className="flex flex-1 items-center justify-between gap-2">
          <span className="font-medium">Everything — all premium features</span>
          <span className="font-semibold">{formatPrice(PRICE_CAP_CENTS)}</span>
        </div>
      </label>

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
                {f.setupInfo && (
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    <span>(some setup required)</span>
                    <InfoButton title={`${f.label} — what you’ll set up`} size="sm" align="left">
                      <p>{f.setupInfo}</p>
                    </InfoButton>
                  </div>
                )}
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
          <p className="rounded-md bg-primary/5 p-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Your setup is saved.</span> Name it and
            reuse it for your next tournament — race lengths, venue and tables carry over. You’ll
            just add any new players’ handicaps.
          </p>
        </div>
      )}

      <PaymentMethodDialog
        open={pending !== null}
        saving={saving}
        onVerified={handleVerified}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
