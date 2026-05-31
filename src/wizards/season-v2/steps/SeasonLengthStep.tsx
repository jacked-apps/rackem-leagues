/**
 * @fileoverview SeasonLengthStep — how many regular season weeks
 *
 * Click-thru pattern (same shape as ChampionshipStep): conversational
 * question + [Skip — X weeks] / [Change weeks →] buttons.
 *
 * **Next-season mode** (when `_flowContext.previousSeasonLength` is
 * provided): Skip commits the previous length + advances. Change reveals
 * the NumberStepper inline.
 *
 * **First-season / fallback mode**: bare NumberStepper defaulting to 16.
 *
 * Range: 6-52 weeks.
 */

import { useEffect, useState } from 'react';
import { NumberStepper } from '@/components/wizard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

const DEFAULT_LENGTH = 16;

interface FlowContextShape {
  previousSeasonLength?: number;
}

export function SeasonLengthStep({
  value,
  onChange,
  onNext,
  formData,
}: WizardStepProps<number | undefined, SeasonWizardFormData>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;

  const previousLength = flowContext?.previousSeasonLength;

  if (previousLength != null) {
    return (
      <NextSeasonLengthPicker
        value={value}
        onChange={onChange}
        onNext={onNext}
        previousLength={previousLength}
      />
    );
  }

  return <FirstSeasonLengthPicker value={value} onChange={onChange} />;
}

function FirstSeasonLengthPicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  useEffect(() => {
    if (value == null) onChange(DEFAULT_LENGTH);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NumberStepper
      label="How many weeks of regular season play?"
      labelInfoButton={{
        title: 'Season Length',
        content: (
          <p>
            The number of regular season weeks before playoffs begin.
            Most leagues run 12-20 weeks. Playoff weeks are added on
            top of this in the next step.
          </p>
        ),
      }}
      value={value ?? DEFAULT_LENGTH}
      onChange={onChange}
      min={6}
      max={52}
    />
  );
}

function NextSeasonLengthPicker({
  value,
  onChange,
  onNext,
  previousLength,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  onNext: () => void;
  previousLength: number;
}) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (value == null) onChange(previousLength);
  }, [previousLength, value, onChange]);

  const handleSkip = () => {
    onChange(previousLength);
    onNext();
  };

  if (!editing) {
    return (
      <div className="space-y-6 max-w-lg">
        <div>
          <Label className="text-base">Regular season length</Label>
          <p className="text-foreground mt-1">
            Last season ran <strong>{previousLength} weeks</strong>. Same again?
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSkip} loadingText="none">
            Keep — {previousLength} weeks
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            loadingText="none"
          >
            Change weeks →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="font-medium text-foreground">Change regular season length</p>

      <NumberStepper
        label="Weeks of regular play"
        value={value ?? DEFAULT_LENGTH}
        onChange={onChange}
        min={6}
        max={52}
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onChange(previousLength);
          setEditing(false);
        }}
        loadingText="none"
      >
        ← Use last season&rsquo;s length instead
      </Button>
    </div>
  );
}
