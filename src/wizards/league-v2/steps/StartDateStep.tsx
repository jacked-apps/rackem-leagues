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
import { GlossaryInfoButton } from '@/components/GlossaryInfoButton';
import { formatLocalDate, getDayOfWeekName } from '@/utils/formatters';
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
        <p className="font-medium text-foreground">When does your season begin?</p>
        {/* Unit 2.5 smoke test — first live GlossaryInfoButton. The inline
            help that used to live here now reads from the `start-date`
            glossary entry. */}
        <GlossaryInfoButton slug="start-date" size="sm" />
      </div>

      <Calendar
        value={value ?? ''}
        onChange={onChange}
        placeholder="Select start date"
        minDate={today}
      />

      {value && (
        <p className="text-sm text-muted-foreground">
          Matches will play every <strong>{getDayOfWeekName(value)}</strong>
        </p>
      )}
    </div>
  );
}
