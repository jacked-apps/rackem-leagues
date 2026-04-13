/**
 * @fileoverview PlayoffWeeksStep — how many weeks of playoffs
 *
 * Uses NumberStepper. Range: 0-4 weeks. Default: 1.
 * 0 means no playoffs for this season.
 */

import { useEffect } from 'react';
import { NumberStepper } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

const DEFAULT_PLAYOFF_WEEKS = 1;

export function PlayoffWeeksStep({
  value,
  onChange,
  formData,
}: WizardStepProps<number | undefined, SeasonWizardFormData>) {
  // Save the default on mount so it appears in the summary
  useEffect(() => {
    if (value == null) onChange(DEFAULT_PLAYOFF_WEEKS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const seasonLength = formData['season-length'] ?? 16;
  const playoffWeeks = value ?? DEFAULT_PLAYOFF_WEEKS;
  const totalWeeks = seasonLength + playoffWeeks;

  return (
    <div className="space-y-4">
      <NumberStepper
        label="How many weeks of playoffs?"
        labelInfoButton={{
          title: 'Playoff Weeks',
          content: (
            <p>
              The number of weeks added after the regular season for
              playoff matches. Set to 0 if this season has no playoffs.
            </p>
          ),
        }}
        value={playoffWeeks}
        onChange={onChange}
        min={0}
        max={4}
      />

      <p className="text-sm text-gray-600">
        Total season: <strong>{seasonLength} regular</strong>
        {playoffWeeks > 0 && <> + <strong>{playoffWeeks} playoff</strong></>}
        {' = '}<strong>{totalWeeks} weeks</strong>
      </p>
    </div>
  );
}
