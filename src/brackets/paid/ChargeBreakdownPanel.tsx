/**
 * @fileoverview What the organizer is paying for, on the checkout card (Unit C3).
 *
 * Collapsed by default — the headline is the price on the button, and the
 * itemisation is there for the moment someone wonders "what am I actually
 * buying?" rather than something they must read every time.
 *
 * Laid out like a receipt: items on the left with amounts in a right-hand
 * column, a rule, then the total pushed over to sit BESIDE its amount. A total
 * styled as just another full-width row reads as one more thing being charged —
 * the reason the first version looked like a second dollar.
 *
 * The $5 cap gets its own line when it bites. Six features at $1 each add to $6
 * while the button says $5, and a list that doesn't add up to the total reads
 * like a bug even when the cheaper number is the honest one.
 *
 * Amounts use tabular figures so the digits line up in a column; proportional
 * numerals make a short list of prices look ragged.
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { chargeBreakdown, formatPrice } from './premiumFeatures';

interface ChargeBreakdownPanelProps {
  /** `brackets.premium_features` — what this tournament bought. */
  featureKeys: readonly string[];
}

export function ChargeBreakdownPanel({ featureKeys }: ChargeBreakdownPanelProps) {
  const { lines, subtotalCents, capDiscountCents, totalCents } =
    chargeBreakdown(featureKeys);

  if (lines.length === 0) return null;

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="charge" className="border-b-0">
        <AccordionTrigger className="py-2 text-sm">
          {lines.length} {lines.length === 1 ? 'feature' : 'features'} ·{' '}
          {formatPrice(totalCents)}
        </AccordionTrigger>
        <AccordionContent>
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
            <div className="mt-1 flex justify-end gap-6 border-t pt-1.5 font-semibold">
              <dt>Total</dt>
              <dd>{formatPrice(totalCents)}</dd>
            </div>
          </dl>

          <p className="mt-1 text-right text-xs text-muted-foreground">
            Charged when you start the tournament.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
