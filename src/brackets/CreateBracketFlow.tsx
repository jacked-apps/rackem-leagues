/**
 * @fileoverview Create-bracket flow orchestrator (Unit 4).
 *
 * A lightweight linear flow (details → participants → review) for an authed
 * organizer to spin up a bracket. On submit it creates the bracket, persists
 * participants (seed order resolved by mode), and starts it (generates + saves
 * the match tree), then routes to the live bracket view. Ephemeral — no
 * persistence/resume, unlike the league wizard.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import {
  useCreateBracket,
  useSetParticipants,
  useStartBracket,
  useChargeForStart,
} from '@/api/hooks/useBrackets';
import {
  useDefaultPaymentMethod,
  useSaveDefaultPaymentMethod,
} from '@/api/hooks/usePaymentMethods';
import type { PaymentCardData } from '@/components/PaymentCardForm';
import { useCreateBracketForm } from './useCreateBracketForm';
import { DetailsStep } from './steps/DetailsStep';
import { ParticipantsStep } from './steps/ParticipantsStep';
import { ReviewStep } from './steps/ReviewStep';
import { PremiumFeaturesSection } from './paid/PremiumFeaturesSection';
import { totalPriceCents, formatPrice, type PremiumFeature } from './paid/premiumFeatures';

const STEP_TITLES = {
  details: 'Tournament details',
  participants: 'Add players',
  review: 'Seeding & review',
} as const;

export function CreateBracketFlow() {
  const navigate = useNavigate();
  const { data: member } = useCurrentMember();
  const form = useCreateBracketForm();
  const { state, validation } = form;

  const createBracket = useCreateBracket();
  const setParticipants = useSetParticipants();
  const startBracket = useStartBracket();
  const chargeForStart = useChargeForStart();
  const [submitting, setSubmitting] = useState(false);

  // Paid = any premium feature checked; its price is charged at Start (checkout).
  const isPaid = state.premiumFeatures.length > 0;
  const chargeCents = totalPriceCents(state.premiumFeatures);

  // The player's card on file (reusable across tournaments/dues). If they already
  // have one, seed it so turning on a premium feature just confirms — no re-entry.
  const { data: defaultCard } = useDefaultPaymentMethod(member?.id);
  const saveCard = useSaveDefaultPaymentMethod();
  useEffect(() => {
    if (defaultCard && !state.cardOnFile) {
      form.setCardOnFile({
        paymentMethodId: defaultCard.id,
        last4: defaultCard.card_last4 ?? '',
        brand: defaultCard.card_brand ?? '',
        nickname: defaultCard.nickname,
      });
    }
  }, [defaultCard, state.cardOnFile, form]);

  /**
   * Turn a premium feature on. First time (no card yet) we save the verified card
   * to the player's card-on-file; after that the same card is reused. Then check
   * the feature. Verify-at-setup — no charge happens here (that's at Start).
   */
  const handleEnableFeature = async (
    feature: PremiumFeature,
    card?: PaymentCardData,
    nickname?: string
  ) => {
    try {
      if (card && member?.id) {
        const paymentMethodId = await saveCard.mutateAsync({
          memberId: member.id,
          token: card.paymentToken,
          cardLast4: card.cardLast4,
          cardBrand: card.cardBrand,
          nickname,
        });
        form.setCardOnFile({
          paymentMethodId,
          last4: card.cardLast4,
          brand: card.cardBrand,
          nickname: nickname ?? null,
        });
      }
      form.togglePremiumFeature(feature.key);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your card.');
    }
  };

  /** Create → set participants → start, then go to the live view. */
  const handleSubmit = async () => {
    if (!member?.id || !validation.canSubmit) return;
    // A paid tournament must have a card on file (normally set up when a feature
    // was enabled) — belt-and-suspenders before checkout.
    if (isPaid && !state.cardOnFile) {
      toast.error('Add a payment method before starting a paid tournament.');
      return;
    }
    setSubmitting(true);
    try {
      const bracket = await createBracket.mutateAsync({
        name: state.name.trim(),
        format: state.format,
        seedingMode: state.seedingMode,
        grandFinalReset: state.grandFinalReset,
        createdBy: member.id,
        // Paid tier: any premium feature checked ⇒ paid; charge the card on file at Start.
        premiumFeatures: state.premiumFeatures,
        gameType: state.gameType,
        paymentMethodId: state.cardOnFile?.paymentMethodId ?? null,
      });
      await setParticipants.mutateAsync({
        bracketId: bracket.id,
        participants: state.participants.map((displayName) => ({ displayName })),
        seedingMode: state.seedingMode,
      });
      await startBracket.mutateAsync({
        bracketId: bracket.id,
        format: state.format,
        grandFinalReset: state.grandFinalReset,
        participantCount: state.participants.length,
      });
      // Checkout: charge the card on file at Start (AFTER a successful start, so a
      // failed start can't leave a charged-but-not-started bracket). $0 mock today.
      if (isPaid) {
        await chargeForStart.mutateAsync({ bracketId: bracket.id, amountCents: chargeCents });
      }
      navigate(`/brackets/${bracket.id}`);
    } catch (err) {
      // Left in `setup` with participants intact — the organizer can retry.
      toast.error(err instanceof Error ? err.message : 'Could not start the bracket.');
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{STEP_TITLES[state.step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {state.step === 'details' && (
            <>
              <DetailsStep
                name={state.name}
                format={state.format}
                grandFinalReset={state.grandFinalReset}
                gameType={state.gameType}
                onNameChange={(v) => form.set('name', v)}
                onFormatChange={(v) => form.set('format', v)}
                onResetChange={(v) => form.set('grandFinalReset', v)}
                onGameTypeChange={(v) => form.set('gameType', v)}
              />
              <PremiumFeaturesSection
                selectedKeys={state.premiumFeatures}
                cardOnFile={state.cardOnFile}
                saving={saveCard.isPending}
                onEnable={handleEnableFeature}
                onDisable={form.togglePremiumFeature}
              />
            </>
          )}

          {state.step === 'participants' && (
            <>
              <ParticipantsStep
                participants={state.participants}
                onAdd={form.addParticipant}
                onRemove={form.removeParticipant}
                onMove={form.moveParticipant}
              />
              {validation.hasDuplicates && (
                <p className="text-sm text-amber-600">
                  Some names are duplicated — that's allowed, just make sure it's
                  intentional.
                </p>
              )}
            </>
          )}

          {state.step === 'review' && (
            <ReviewStep
              participants={state.participants}
              seedingMode={state.seedingMode}
              onSeedingModeChange={(v) => form.set('seedingMode', v)}
            />
          )}

          <FlowNav
            step={state.step}
            canAdvance={
              state.step === 'details' ? validation.nameOk : validation.countOk
            }
            canSubmit={validation.canSubmit}
            submitLabel={isPaid ? `Start & pay ${formatPrice(chargeCents)}` : 'Start tournament'}
            submitting={submitting}
            onBack={() =>
              // On the first step there's no prior step — leave the flow back to
              // the tournaments list instead of a dead disabled button.
              state.step === 'details'
                ? navigate('/brackets')
                : form.goTo(state.step === 'review' ? 'participants' : 'details')
            }
            onNext={() =>
              form.goTo(state.step === 'details' ? 'participants' : 'review')
            }
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/** Back / Next / Start controls for the current step. */
function FlowNav({
  step,
  canAdvance,
  canSubmit,
  submitLabel,
  submitting,
  onBack,
  onNext,
  onSubmit,
}: {
  step: 'details' | 'participants' | 'review';
  canAdvance: boolean;
  canSubmit: boolean;
  submitLabel: string;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex justify-between pt-2">
      <Button type="button" variant="outline" onClick={onBack}>
        {step === 'details' ? 'Cancel' : 'Back'}
      </Button>
      {step === 'review' ? (
        <Button
          type="button"
          loadingText="Starting…"
          isLoading={submitting}
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      ) : (
        <Button type="button" loadingText="none" disabled={!canAdvance} onClick={onNext}>
          Next
        </Button>
      )}
    </div>
  );
}
