/**
 * @fileoverview StartDateStep — second question in the League Creation Wizard
 *
 * Asks the operator when the league starts. The date determines:
 * - Day of the week (matches play on this day every week)
 * - Season name (Spring/Summer/Fall/Winter)
 * - Year
 *
 * These derived values are used in the auto-generated league name.
 * Uses the project Calendar component and timezone-safe date utilities.
 */

import { Calendar } from '@/components/ui/calendar';
import { InfoButton } from '@/components/InfoButton';
import { formatLocalDate } from '@/utils/formatters';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

export function StartDateStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  const today = formatLocalDate(new Date());

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <p className="font-medium text-gray-900">When does your season begin?</p>
        <InfoButton title="Start Date" size="sm">
          <p>
            Choose the first match date. This determines the day of the
            week your league plays on (matches repeat weekly on this day).
            It also sets the season name and year used in the league name.
          </p>
        </InfoButton>
      </div>

      <Calendar
        value={value ?? ''}
        onChange={onChange}
        placeholder="Select start date"
        minDate={today}
      />

      {value && (
        <p className="text-sm text-gray-600">
          Matches will play every <strong>{getDayName(value)}</strong>
        </p>
      )}
    </div>
  );
}

/** Get the day name from an ISO date string using local timezone */
function getDayName(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}
