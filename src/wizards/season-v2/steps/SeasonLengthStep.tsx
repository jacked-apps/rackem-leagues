/**
 * @fileoverview SeasonLengthStep — how many regular season weeks
 *
 * Two modes:
 *
 * 1. **Next-season mode** (when `_flowContext.previousSeasonLength` exists)
 *    — show two radio choices: "Same as last (X weeks)" or "Choose different".
 *    Selecting "different" reveals the NumberStepper.
 *
 * 2. **First-season / fallback mode** — single NumberStepper defaulting to 16.
 *
 * Same UX pattern as `SeasonStartDateStep` so subsequent-season operators
 * see a consistent confirm-or-change flow.
 *
 * Range: 6-52 weeks. Default: 16 (most common) when no previous-season anchor.
 */

import { useEffect } from 'react';
import { NumberStepper } from '@/components/wizard';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

const DEFAULT_LENGTH = 16;

interface FlowContextShape {
  previousSeasonLength?: number;
}

export function SeasonLengthStep({
  value,
  onChange,
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
        previousLength={previousLength}
      />
    );
  }

  return <FirstSeasonLengthPicker value={value} onChange={onChange} />;
}

/** Original behavior: bare NumberStepper, default 16. */
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

/** 2-choice radio + reveal-on-change pattern. */
function NextSeasonLengthPicker({
  value,
  onChange,
  previousLength,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  previousLength: number;
}) {
  // Default to "Same as last" on first mount
  useEffect(() => {
    if (value == null) onChange(previousLength);
  }, [previousLength, value, onChange]);

  const mode: 'same' | 'different' = value === previousLength ? 'same' : 'different';

  const handleModeChange = (next: string) => {
    if (next === 'same') onChange(previousLength);
    else onChange(previousLength === DEFAULT_LENGTH ? 12 : DEFAULT_LENGTH);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label className="text-base">How many weeks of regular season play?</Label>
      </div>

      <RadioGroup value={mode} onValueChange={handleModeChange} className="space-y-3">
        <ChoiceRow
          id="same"
          label={`Same as last season — ${previousLength} weeks`}
          sublabel="Most leagues stay the same season to season."
        />
        <ChoiceRow
          id="different"
          label="Choose different"
          sublabel="Pick a new week count below."
        />
      </RadioGroup>

      {mode === 'different' && (
        <div className="pt-2 pl-7">
          <NumberStepper
            label="Weeks of regular play"
            value={value ?? DEFAULT_LENGTH}
            onChange={onChange}
            min={6}
            max={52}
          />
        </div>
      )}
    </div>
  );
}

function ChoiceRow({
  id,
  label,
  sublabel,
}: {
  id: string;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex items-start gap-3 cursor-pointer">
      <RadioGroupItem value={id} id={id} className="mt-1" />
      <Label htmlFor={id} className="cursor-pointer flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{sublabel}</div>
      </Label>
    </div>
  );
}
