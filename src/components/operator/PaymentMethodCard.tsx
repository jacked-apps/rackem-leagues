/**
 * @fileoverview Payment Method Card
 *
 * Displays payment method information (credit card).
 * Currently shows "Coming Soon" - will be implemented when Stripe integration is ready.
 *
 * Future: Will display card_brand and card_last4 from operator profile
 * and provide "Update Card" button to open Stripe payment modal.
 */

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Organization } from '@/api/queries/organizations';

interface PaymentMethodCardProps {
  organization: Organization;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  organization,
}) => {
  // Suppress unused variable warning - will be used when Stripe is implemented
  void organization;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg p-4 bg-muted">
          <p className="text-sm text-muted-foreground font-medium mb-2">Credit Card</p>
          <p className="text-sm text-muted-foreground mb-4">
            Credit card management will be available when Stripe integration is complete
          </p>
          <Button disabled className="w-full cursor-not-allowed opacity-50" loadingText="none">
            Coming Soon
          </Button>
          {/* TODO: Implement credit card update when Stripe integration is ready */}
          {/* Will need to show card_brand and card_last4 */}
          {/* Add "Update Card" button that opens Stripe payment modal */}
        </div>
      </CardContent>
    </Card>
  );
};
