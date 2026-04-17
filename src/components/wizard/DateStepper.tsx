/**
 * @fileoverview DateStepper — week-based date selector with ← → arrows
 *
 * Moves exactly 7 days per click so only the correct day of week is shown.
 * All date math uses parseLocalDate/formatLocalDate to avoid UTC bugs.
 */

import { Button } from '@/components/ui/button';
import { InfoButton } from '@/components/InfoButton';
import { parseLocalDate, formatLocalDate } from '@/utils/formatters';

interface DateStepperProps {
  /** Current date value (ISO string YYYY-MM-DD) */
  value: string;

  /** Called when date changes via arrows */
  onChange: (value: string) => void;

  /** Earliest allowed date (ISO string). Arrow won't go before this. */
  minDate?: string;

  /** Latest allowed date (ISO string). Arrow won't go past this. */
  maxDate?: string;

  /** Optional label above the stepper */
  label?: string;

  /** Optional info button next to the label */
  labelInfoButton?: { title: string; content: React.ReactNode };
}

/** Add days to an ISO date string using local timezone math */
function addDays(isoDate: string, days: number): string {
  const date = parseLocalDate(isoDate);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

/** Format an ISO date for display: "Monday, April 14, 2026" */
function formatDisplayDate(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function DateStepper({
  value,
  onChange,
  minDate,
  maxDate,
  label,
  labelInfoButton,
}: DateStepperProps) {
  const prevWeek = addDays(value, -7);
  const nextWeek = addDays(value, 7);

  const atMin = minDate ? prevWeek < minDate : false;
  const atMax = maxDate ? nextWeek > maxDate : false;

  return (
    <div className="space-y-2">
      {(label || labelInfoButton) && (
        <div className="flex items-center gap-1">
          {label && <p className="font-medium text-gray-900">{label}</p>}
          {labelInfoButton && (
            <InfoButton title={labelInfoButton.title} size="sm">
              {labelInfoButton.content}
            </InfoButton>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => onChange(prevWeek)}
          disabled={atMin}
          className="w-12 h-12 text-xl"
        >
          ←
        </Button>
        <span className="text-lg font-medium text-center flex-1">
          {formatDisplayDate(value)}
        </span>
        <Button
          variant="outline"
          onClick={() => onChange(nextWeek)}
          disabled={atMax}
          className="w-12 h-12 text-xl"
        >
          →
        </Button>
      </div>
    </div>
  );
}
