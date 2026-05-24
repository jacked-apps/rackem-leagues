/**
 * @fileoverview SeasonStartDateStep — pick start date for subsequent seasons
 *
 * Click-thru pattern (same shape as ChampionshipStep): conversational
 * question + [Skip — start immediately] / [Change start date →] buttons.
 *
 * **Next-season mode** (when `_flowContext.previousSeasonLastWeekDate`
 * is provided): Skip commits "previous last week + 7 days" and advances.
 * Change reveals three sub-options:
 *   - Start immediately (last + 7)
 *   - Take a week off (last + 14)
 *   - Take more time off → DateStepper, minDate = last + 21,
 *     locked to weekly increments on the league's play DOW.
 *
 * **First-season / fallback mode**: single DateStepper defaulting to
 * today (original behavior).
 */

import { useState } from 'react';
import { DateStepper } from '@/components/wizard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatLocalDate, parseLocalDate, getDayOfWeekName } from '@/utils/formatters';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

function addDays(isoDate: string, days: number): string {
  const date = parseLocalDate(isoDate);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

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
  onNext,
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
        onNext={onNext}
        lastWeekDate={lastWeekDate}
      />
    );
  }

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

function NextSeasonStartDatePicker({
  value,
  onChange,
  onNext,
  lastWeekDate,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  onNext: () => void;
  lastWeekDate: string;
}) {
  const startImmediate = addDays(lastWeekDate, 7);
  const weekOff = addDays(lastWeekDate, 14);
  const customMin = addDays(lastWeekDate, 21);
  const dayName = getDayOfWeekName(lastWeekDate);

  const [editing, setEditing] = useState(false);

  // No mount auto-fill: the summary should only show what the operator
  // has actively chosen. The 3 buttons below are the only way to set a
  // value here.

  const handlePick = (next: string) => {
    onChange(next);
    onNext();
  };

  const isCustom =
    !!value && value !== startImmediate && value !== weekOff;

  if (!editing) {
    return (
      <div className="space-y-6 max-w-lg">
        <div>
          <Label className="text-base">When does the new season start?</Label>
          <p className="text-foreground mt-1">
            Last season&rsquo;s final week was{' '}
            <strong>{formatPretty(lastWeekDate)}</strong>. Pick when the
            next one kicks off:
          </p>
        </div>

        <div className="space-y-2">
          <Button
            onClick={() => handlePick(startImmediate)}
            loadingText="none"
            className="w-full justify-start"
          >
            Start immediately — {formatPretty(startImmediate)}
          </Button>
          <Button
            onClick={() => handlePick(weekOff)}
            loadingText="none"
            className="w-full justify-start"
          >
            Take a week off — {formatPretty(weekOff)}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!isCustom) onChange(customMin);
              setEditing(true);
            }}
            loadingText="none"
            className="w-full justify-start"
          >
            Take more time off — pick a {dayName} →
          </Button>
        </div>
      </div>
    );
  }

  // Edit mode — custom date picker
  return (
    <div className="space-y-4 max-w-lg">
      <p className="font-medium text-foreground">Pick a custom start {dayName}</p>

      <div className="space-y-2">
        <Button
          variant={value === startImmediate ? 'default' : 'outline'}
          onClick={() => handlePick(startImmediate)}
          loadingText="none"
          className="w-full justify-start"
        >
          Start immediately — {formatPretty(startImmediate)}
        </Button>
        <Button
          variant={value === weekOff ? 'default' : 'outline'}
          onClick={() => handlePick(weekOff)}
          loadingText="none"
          className="w-full justify-start"
        >
          Take a week off — {formatPretty(weekOff)}
        </Button>
        <Button
          variant={isCustom ? 'default' : 'outline'}
          onClick={() => {
            if (!isCustom) onChange(customMin);
          }}
          loadingText="none"
          className="w-full justify-start"
        >
          Take more time off — pick a {dayName}
        </Button>
      </div>

      {value && value !== startImmediate && value !== weekOff && (
        <div className="pt-2">
          <DateStepper
            label="Pick a start date"
            value={value}
            onChange={onChange}
            minDate={customMin}
          />
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onChange(startImmediate);
          setEditing(false);
        }}
        loadingText="none"
      >
        ← Use last season&rsquo;s timing instead
      </Button>
    </div>
  );
}
