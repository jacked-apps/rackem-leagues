/**
 * @fileoverview The itemised charge, laid out like a receipt (Unit C3).
 *
 * Shared by the checkout card's collapsed accordion and the final confirm
 * dialog, so the money the organizer glances at and the money they approve are
 * rendered by the same code. Two receipts computed separately is how a checkout
 * drifts into telling someone two different numbers.
 *
 * Items on the left with amounts in a right-hand column, a rule, then the total
 * pushed over to sit BESIDE its amount and set a step larger — a total styled
 * like the rows above it reads as one more thing being charged.
 *
 * Amounts use tabular figures so the digits line up; proportional numerals make
 * a short column of prices look ragged.
 */

import { chargeBreakdown, formatPrice } from './premiumFeatures';

interface ChargeReceiptProps {
  /** `brackets.premium_features` — what this tournament bought. */
  featureKeys: readonly string[];
}

export function ChargeReceipt({ featureKeys }: ChargeReceiptProps) {
  const { lines, subtotalCents, capDiscountCents, totalCents } =
    chargeBreakdown(featureKeys);

  if (lines.length === 0) return null;

  return (
    <>
      <dl className="text-sm tabular-nums">
        {lines.map((line) => (
          <div key={line.key} className="flex justify-between gap-4 py-0.5">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd>{formatPrice(line.cents)}</dd>
          </div>
        ))}

        {/* Only when the cap actually reduced the bill. */}
        {capDiscountCents > 0 && (
          <>
            <div className="flex justify-between gap-4 py-0.5 text-muted-foreground">
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotalCents)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-0.5 text-success">
              <dt>Everything-included discount</dt>
              <dd>−{formatPrice(capDiscountCents)}</dd>
            </div>
          </>
        )}

        {/* The total sits with its amount, away from the item column. */}
        <div className="mt-1 flex justify-end gap-6 border-t pt-1.5 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatPrice(totalCents)}</dd>
        </div>
      </dl>

      <p className="mt-1 text-right text-xs text-muted-foreground">
        Charged when you start the tournament.
      </p>
    </>
  );
}
