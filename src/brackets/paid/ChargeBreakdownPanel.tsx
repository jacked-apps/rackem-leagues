/**
 * @fileoverview What the organizer is paying for, on the checkout card (Unit C3).
 *
 * Collapsed by default — the headline is the price on the button, and the
 * itemisation is there for the moment someone wonders "what am I actually
 * buying?" rather than something they must read every time.
 *
 * The $5 cap gets its own line when it bites. Six features at $1 each add to $6
 * while the button says $5, and a list that doesn't add up to the total reads
 * like a bug even when the cheaper number is the honest one.
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
          <dl className="space-y-1 text-sm">
            {lines.map((line) => (
              <div key={line.key} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd>{formatPrice(line.cents)}</dd>
              </div>
            ))}

            {/* Only when the cap actually reduced the bill. */}
            {capDiscountCents > 0 && (
              <div className="flex justify-between gap-4 text-success">
                <dt>Everything-included discount</dt>
                <dd>−{formatPrice(capDiscountCents)}</dd>
              </div>
            )}

            <div className="flex justify-between gap-4 border-t pt-1 font-medium">
              <dt>Charged at start</dt>
              <dd>{formatPrice(totalCents)}</dd>
            </div>

            {capDiscountCents > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                {formatPrice(subtotalCents)} of features, capped at{' '}
                {formatPrice(totalCents)}.
              </p>
            )}
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
