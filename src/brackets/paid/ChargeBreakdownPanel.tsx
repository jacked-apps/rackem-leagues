/**
 * @fileoverview What the organizer is paying for, on the checkout card (Unit C3).
 *
 * Collapsed by default — the headline is the price on the button, and the
 * itemisation is there for the moment someone wonders "what am I actually
 * buying?" rather than something they must read every time. The final confirm
 * shows the same receipt expanded, from the same component.
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ChargeReceipt } from './ChargeReceipt';
import { chargeBreakdown, formatPrice } from './premiumFeatures';

interface ChargeBreakdownPanelProps {
  /** `brackets.premium_features` — what this tournament bought. */
  featureKeys: readonly string[];
}

export function ChargeBreakdownPanel({ featureKeys }: ChargeBreakdownPanelProps) {
  const { lines, totalCents } = chargeBreakdown(featureKeys);

  if (lines.length === 0) return null;

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="charge" className="border-b-0">
        <AccordionTrigger className="py-2 text-sm">
          {lines.length} {lines.length === 1 ? 'feature' : 'features'} ·{' '}
          {formatPrice(totalCents)}
        </AccordionTrigger>
        <AccordionContent>
          <ChargeReceipt featureKeys={featureKeys} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
