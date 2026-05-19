/**
 * @fileoverview SeasonStartDateStep — pick start date for subsequent seasons
 *
 * For the **next-season flow** (where the previous season's
 * `previousSeasonLastWeekDate` is provided via `_flowContext`), this step
 * surfaces three explicit choices so the operator can't accidentally land
 * on today's date or skip a play day:
 *
 *   1. Start immediately  → last played week + 7 days
 *   2. Take a week off    → last played week + 14 days
 *   3. Take more time off → custom date (DateStepper, locked to weekly
 *                           increments anchored on the league's play DOW)
 *
 * For the **first-season-but-not-first** flow (subsequent seasons with no
 * prior-week context), it falls back to the original behavior: a single
 * DateStepper defaulting to today.
 *
 * The weekly-increment math is handled by `DateStepper` — we just seed it
 * with a date on the correct day of the week.
 */

import { useEffect } from 'react';
import { DateStepper } from '@/components/wizard';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatLocalDate, parseLocalDate, getDayOfWeekName } from '@/utils/formatters';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

/** Add days to an ISO date string using local timezone math */
function addDays(isoDate: string, days: number): string {
  const date = parseLocalDate(isoDate);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

/** Format an ISO date for display: "Tuesday, May 26, 2026" */
function formatPretty(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface FlowContextShape {
  previousSeasonLastWeekDate?: string;
  dayOfWeek?: string;
}

export function SeasonStartDateStep({
  value,
  onChange,
  formData,
}: WizardStepProps<string | undefined, SeasonWizardFormData>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;

  const lastWeekDate = flowContext?.previousSeasonLastWeekDate;

  if (lastWeekDate) {
    return (
      <NextSeasonStartDatePicker
        value={value}
        onChange={onChange}
        lastWeekDate={lastWeekDate}
      />
    );
  }

  // Fallback: no prior-week context (e.g. a subsequent season created
  // through a path that doesn't pre-load it). Original behavior.
  const today = formatLocalDate(new Date());
  return (
    <DateStepper
      label="When does the new season start?"
      labelInfoButton={{
        title: 'Season Start Date',
        content: (
          <p>
            Pick the first league night of the new season. The date moves
            in weekly increments to stay on your league&rsquo;s regular
            play day.
          </p>
        ),
      }}
      value={value ?? today}
      onChange={onChange}
      minDate={today}
    />
  );
}

/** 3-choice radio + custom date picker. Last-played-week + 7/14/21 days. */
function NextSeasonStartDatePicker({
  value,
  onChange,
  lastWeekDate,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  lastWeekDate: string;
}) {
  const startImmediate = addDays(lastWeekDate, 7);
  const weekOff = addDays(lastWeekDate, 14);
  const customMin = addDays(lastWeekDate, 21);
  const dayName = getDayOfWeekName(lastWeekDate);

  // Default to "Start immediately" on first mount if no value yet
  useEffect(() => {
    if (!value) onChange(startImmediate);
  }, [startImmediate, value, onChange]);

  // Identify which choice the current value represents
  const mode: 'immediate' | 'week-off' | 'custom' =
    value === startImmediate
      ? 'immediate'
      : value === weekOff
        ? 'week-off'
        : 'custom';

  const handleModeChange = (next: string) => {
    if (next === 'immediate') onChange(startImmediate);
    else if (next === 'week-off') onChange(weekOff);
    else onChange(customMin);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label className="text-base">When does the new season start?</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Previous season&rsquo;s last week was{' '}
          <strong>{formatPretty(lastWeekDate)}</strong>. The new season
          must start on a future {dayName}.
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={handleModeChange} className="space-y-3">
        <ChoiceRow
          id="immediate"
          label="Start immediately"
          sublabel={`Begins ${formatPretty(startImmediate)}`}
        />
        <ChoiceRow
          id="week-off"
          label="Take a week off"
          sublabel={`Begins ${formatPretty(weekOff)}`}
        />
        <ChoiceRow
          id="custom"
          label="Take more time off"
          sublabel="Pick a date below"
        />
      </RadioGroup>

      {mode === 'custom' && (
        <div className="pt-2 pl-7">
          <DateStepper
            label="Pick a start date"
            value={value && value !== startImmediate && value !== weekOff ? value : customMin}
            onChange={onChange}
            minDate={customMin}
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
