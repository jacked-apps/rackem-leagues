/**
 * @fileoverview SeasonStartDateStep — pick start date for subsequent seasons
 *
 * Only shown for seasons AFTER the first one (the first season inherits
 * the league's start date). Uses DateStepper which moves in 7-day
 * increments so only the correct day of week is selectable.
 */

import { DateStepper } from '@/components/wizard';
import { formatLocalDate } from '@/utils/formatters';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

export function SeasonStartDateStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, SeasonWizardFormData>) {
  // Default to next week from today if no value set
  const today = formatLocalDate(new Date());

  return (
    <DateStepper
      label="When does the new season start?"
      labelInfoButton={{
        title: 'Season Start Date',
        content: (
          <p>
            Pick the first league night of the new season. The date
            moves in weekly increments to stay on your league&rsquo;s
            regular play day.
          </p>
        ),
      }}
      value={value ?? today}
      onChange={onChange}
      minDate={today}
    />
  );
}
