/**
 * @fileoverview Become a Host — self-serve purchase that grants the 'host'
 * designation, letting a member host game rooms.
 *
 * Mirrors the League Operator application's shape but far lighter: no
 * questionnaire, just pick a plan and pay. The mock PaymentCardForm "charges"
 * the card; on success we save the card on file (reusable) and grant the host
 * designation, which the game room reads via member_has_designation.
 *
 * Payments are mock today, so nothing is actually billed and expiry is not yet
 * enforced (Phase 2) — the chosen plan is recorded on the grant for when real
 * billing lands. Granting is client-side for now, matching the LO application's
 * interim posture (see mutations/designations.ts).
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PaymentCardForm, type PaymentCardData } from '@/components/PaymentCardForm';
import { useUserProfile } from '@/api/hooks';
import { useSaveDefaultPaymentMethod } from '@/api/hooks/usePaymentMethods';
import { useGrantDesignation } from '@/api/hooks/useDesignationMutations';
import { logger } from '@/utils/logger';

type HostPlan = 'monthly' | 'yearly';

const PLANS: Record<HostPlan, { label: string; price: string; blurb: string }> = {
  monthly: { label: 'Monthly', price: '$1 / month', blurb: 'Billed monthly. Cancel anytime.' },
  yearly: { label: 'Yearly', price: '$10 / year', blurb: 'Two months free vs. monthly.' },
};

/** Intended end date for the chosen plan (recorded on the grant; not enforced yet). */
function computeEndsAt(plan: HostPlan): string {
  const end = new Date();
  if (plan === 'monthly') end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return end.toISOString();
}

export const BecomeHost: React.FC = () => {
  const navigate = useNavigate();
  const { member, hasDesignation, refreshProfile } = useUserProfile();
  const saveCard = useSaveDefaultPaymentMethod();
  const grantDesignation = useGrantDesignation();

  const [plan, setPlan] = useState<HostPlan>('monthly');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const alreadyHost = hasDesignation('host');

  const handleVerified = async (card: PaymentCardData) => {
    if (!member) return;
    setProcessing(true);
    try {
      // Save the card on file (reusable across host dues, tournaments, etc.).
      await saveCard.mutateAsync({
        memberId: member.id,
        token: card.paymentToken,
        cardLast4: card.cardLast4,
        cardBrand: card.cardBrand,
        nickname: 'Host subscription',
      });

      // Grant the host designation — this is what makes them a host.
      await grantDesignation.mutateAsync({
        memberId: member.id,
        designation: 'host',
        source: `purchase:${plan}`,
        endsAt: computeEndsAt(plan),
        grantedBy: member.id,
      });

      await refreshProfile();
      toast.success("You're a host! You can now host game rooms.");
      navigate('/profile');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to become a host', { error: message });
      toast.error(`Could not complete your host signup: ${message}`);
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        backTo="/profile"
        backLabel="Back to Profile"
        title="Become a Host"
        subtitle="Host your own game rooms and invite others to play"
      />

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {alreadyHost ? (
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <h2 className="text-lg font-semibold text-foreground">You're already a host 🎉</h2>
              <p className="text-sm text-muted-foreground">
                Your host access is active — you can host game rooms and invite others.
              </p>
              <Button variant="outline" loadingText="none" onClick={() => navigate('/profile')}>
                Back to Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Choose a plan</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={plan}
                  onValueChange={(v) => setPlan(v as HostPlan)}
                  className="space-y-3"
                >
                  {(Object.keys(PLANS) as HostPlan[]).map((key) => (
                    <Label
                      key={key}
                      htmlFor={`plan-${key}`}
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-4 font-normal hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={key} id={`plan-${key}`} />
                        <div>
                          <p className="font-medium text-foreground">{PLANS[key].label}</p>
                          <p className="text-xs text-muted-foreground">{PLANS[key].blurb}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-foreground">{PLANS[key].price}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentCardForm
                  onVerificationSuccess={handleVerified}
                  onVerificationError={(msg) => toast.error(msg)}
                  loading={processing}
                  verifyButtonText={`Become a host — ${PLANS[plan].price}`}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
