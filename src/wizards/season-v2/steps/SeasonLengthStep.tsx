/**
 * @fileoverview SeasonLengthStep — how many regular season weeks
 *
 * Uses NumberStepper for clean mobile-friendly input.
 * Range: 6-52 weeks. Default: 16 (most common).
 */

import { useEffect } from 'react';
import { NumberStepper } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

const DEFAULT_LENGTH = 16;

export function SeasonLengthStep({
  value,
  onChange,
}: WizardStepProps<number | undefined, SeasonWizardFormData>) {
  // Save the default on mount so it appears in the summary
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
            Most leagues run 12-20 weeks. Playoff weeks are added
            on top of this in the next step.
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
