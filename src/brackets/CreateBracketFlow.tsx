/**
 * @fileoverview Create-bracket flow orchestrator (Unit 4).
 *
 * A lightweight linear flow (details → participants → review) for an authed
 * organizer to spin up a bracket. On submit it creates the bracket, persists
 * participants (seed order resolved by mode), and starts it (generates + saves
 * the match tree), then routes to the live bracket view. Ephemeral — no
 * persistence/resume, unlike the league wizard.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import {
  useCreateBracket,
  useSetParticipants,
  useStartBracket,
} from '@/api/hooks/useBrackets';
import { useCreateBracketForm } from './useCreateBracketForm';
import { DetailsStep } from './steps/DetailsStep';
import { ParticipantsStep } from './steps/ParticipantsStep';
import { ReviewStep } from './steps/ReviewStep';

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
  const [submitting, setSubmitting] = useState(false);

  /** Create → set participants → start, then go to the live view. */
  const handleSubmit = async () => {
    if (!member?.id || !validation.canSubmit) return;
    setSubmitting(true);
    try {
      const bracket = await createBracket.mutateAsync({
        name: state.name.trim(),
        format: state.format,
        seedingMode: state.seedingMode,
        grandFinalReset: state.grandFinalReset,
        createdBy: member.id,
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
            <DetailsStep
              name={state.name}
              format={state.format}
              grandFinalReset={state.grandFinalReset}
              onNameChange={(v) => form.set('name', v)}
              onFormatChange={(v) => form.set('format', v)}
              onResetChange={(v) => form.set('grandFinalReset', v)}
            />
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
            submitting={submitting}
            onBack={() =>
              form.goTo(state.step === 'review' ? 'participants' : 'details')
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
  submitting,
  onBack,
  onNext,
  onSubmit,
}: {
  step: 'details' | 'participants' | 'review';
  canAdvance: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex justify-between pt-2">
      <Button type="button" variant="outline" disabled={step === 'details'} onClick={onBack}>
        Back
      </Button>
      {step === 'review' ? (
        <Button
          type="button"
          loadingText="Starting…"
          isLoading={submitting}
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          Start tournament
        </Button>
      ) : (
        <Button type="button" loadingText="none" disabled={!canAdvance} onClick={onNext}>
          Next
        </Button>
      )}
    </div>
  );
}
