/**
 * @fileoverview LeagueFormatStep — the combined preset/custom format selector
 *
 * Shows 4 cards: 5v5 Fargo (top, BCA priority), 3v3 Standard, 5v5 Standard,
 * and Custom. Picking a preset locks in all modular fields automatically.
 * Picking Custom opens the longer custom path (future steps via showIf).
 *
 * Fargo card shows a manual-entry warning toast on selection.
 * Custom card shows a "longer setup" warning toast on selection.
 */

import { toast } from 'sonner';
import { useCallback } from 'react';
import { CardSelector } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';
import { LEAGUE_FORMAT_OPTIONS } from './leagueFormatOptions';

export function LeagueFormatStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  const handleChange = useCallback(
    (selected: string) => {
      if (selected === 'fargo_5v5') {
        toast.info(
          'Fargo API is not connected yet. Player Fargo ratings will need to be entered manually.',
        );
      }
      if (selected === 'custom') {
        toast.info(
          'Custom setup requires additional questions. Setup time will be longer.',
        );
      }
      onChange(selected);
    },
    [onChange],
  );

  return (
    <CardSelector
      label="Choose your league format"
      labelInfoButton={{
        title: 'League Format',
        content: (
          <p>
            This determines the team size, handicap system, and match
            structure for your league. Choose a standard preset for quick
            setup, or select Custom to configure everything yourself.
          </p>
        ),
      }}
      options={LEAGUE_FORMAT_OPTIONS}
      value={value ?? ''}
      onChange={handleChange}
    />
  );
}
