/**
 * @fileoverview The verify/confirm popup shown when an organizer turns on a
 * premium feature (tournament paid foundation).
 *
 * Shows the feature's blurb, its (preview) price, and the "you won't be charged
 * until you start" promise. If the player has NO card on file yet, it embeds the
 * reusable `PaymentCardForm` ($0 mock verify). If a card is already on file
 * (saved this session or from a prior tournament), it just confirms — the card is
 * reused, no re-entry (the card is the player's, reusable for anything they pay
 * for).
 */

import { PaymentCardForm, type PaymentCardData } from '@/components/PaymentCardForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatPrice, type PremiumFeature } from './premiumFeatures';
import type { CardOnFile } from '../useCreateBracketForm';

interface PremiumFeatureDialogProps {
  /** The feature being enabled — the dialog is open when this is non-null. */
  feature: PremiumFeature | null;
  /** The player's card on file, or null (→ show the card form). */
  cardOnFile: CardOnFile | null;
  /** Saving the card / enabling in flight. */
  saving: boolean;
  /** Confirm: with card data (first-time verify) or no args (reuse card on file). */
  onConfirm: (card?: PaymentCardData) => void;
  /** Dismiss without enabling. */
  onCancel: () => void;
}

export function PremiumFeatureDialog({
  feature,
  cardOnFile,
  saving,
  onConfirm,
  onCancel,
}: PremiumFeatureDialogProps) {
  return (
    <Dialog open={feature !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {feature && (
          <>
            <DialogHeader>
              <DialogTitle>{feature.label}</DialogTitle>
              <DialogDescription>{feature.blurb}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="font-medium">{formatPrice(feature.priceCents)}</span>{' '}
                <span className="text-muted-foreground">(preview pricing)</span> —{' '}
                <span className="font-medium">
                  you won&apos;t be charged until you start the tournament.
                </span>
              </div>

              {cardOnFile ? (
                <>
                  <p className="text-sm">
                    Your card ending in{' '}
                    <span className="font-medium">{cardOnFile.last4}</span> (
                    {cardOnFile.brand}) will be charged when you start.
                  </p>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={onCancel}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      isLoading={saving}
                      loadingText="Adding…"
                      onClick={() => onConfirm()}
                    >
                      Add {feature.label}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <PaymentCardForm
                  loading={saving}
                  verifyButtonText={`Verify card & add — ${formatPrice(feature.priceCents)}`}
                  onVerificationSuccess={(card) => onConfirm(card)}
                />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
