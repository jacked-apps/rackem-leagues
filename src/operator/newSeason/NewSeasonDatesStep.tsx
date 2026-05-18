/**
 * @fileoverview Step 1 of the "Start Next Season" wizard — dates.
 *
 * Operator confirms or adjusts:
 *   - Start date (prefilled = previous_end_date + 7 days, same day-of-week)
 *   - Week count (prefilled = previous_season.season_length)
 *   - End date (derived, read-only display)
 *   - Season name (derived via deriveDateFields, editable for the
 *     rare case where the month boundary doesn't match the league's
 *     mental model — e.g., a season starting late February that the
 *     league still calls "Winter")
 *
 * Holiday/championship conflict warnings are deferred until the
 * schedule step (which is the existing first-time-league component
 * we reuse later). The Dates step here is just the high-level
 * planning info.
 *
 * Closes Unit 3 of docs/plans/2026-05-17-001-feat-new-season-from-previous-plan.md.
 */

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { parseLocalDate } from '@/utils/formatters';
import { deriveDateFields } from '@/wizards/league-v2/leagueWizardHelpers';
import type { NewSeasonPrefill } from '@/api/queries/newSeasonPrefill';
import type { NewSeasonWizardState } from './NewSeasonWizard';

interface NewSeasonDatesStepProps {
  prefill: NewSeasonPrefill;
  value: NewSeasonWizardState;
  onChange: (patch: Partial<NewSeasonWizardState>) => void;
}

export function NewSeasonDatesStep({
  value,
  onChange,
}: NewSeasonDatesStepProps) {
  // End date = startDate + weekCount * 7 days. Read-only display.
  const endDate = useMemo(() => {
    if (!value.startDate || !value.weekCount) return null;
    const start = parseLocalDate(value.startDate);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + value.weekCount * 7 - 1); // -1 so a 12-week season ends on the same day-of-week as it started
    return end;
  }, [value.startDate, value.weekCount]);

  // Derived season name — runs whenever startDate changes. We only
  // *overwrite* the user's value if they haven't customized it yet
  // (seasonName is empty). If they've typed something, keep it.
  const derivedName = useMemo(() => {
    if (!value.startDate) return '';
    const { season, year } = deriveDateFields(value.startDate);
    return `${season} ${year}`;
  }, [value.startDate]);

  useEffect(() => {
    if (!value.seasonName && derivedName) {
      onChange({ seasonName: derivedName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedName]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Pick the dates and week count for the next season. Defaults are
        rolled forward from the previous season — adjust if your league
        needs to skip a week for a holiday or finish earlier.
      </p>

      {/* Start date */}
      <div className="space-y-2">
        <Label htmlFor="start-date">Start date</Label>
        <Calendar
          value={value.startDate}
          onChange={(date) =>
            onChange({
              startDate: date,
              seasonName: '', // clear so the derive effect refills with the new month's season
            })
          }
        />
      </div>

      {/* Week count */}
      <div className="space-y-2">
        <Label htmlFor="week-count">Number of weeks</Label>
        <Input
          id="week-count"
          type="number"
          min={1}
          max={52}
          value={value.weekCount}
          onChange={(e) =>
            onChange({ weekCount: Math.max(1, parseInt(e.target.value, 10) || 0) })
          }
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          Includes regular-season weeks only. Playoffs are scheduled
          separately later.
        </p>
      </div>

      {/* End date (read-only) */}
      <div className="space-y-2">
        <Label>End date</Label>
        <p className="text-sm font-medium">
          {endDate
            ? endDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : '—'}
        </p>
        <p className="text-xs text-muted-foreground">
          Automatically derived from start date + week count.
        </p>
      </div>

      {/* Season name (derived, editable) */}
      <div className="space-y-2">
        <Label htmlFor="season-name">Season name</Label>
        <Input
          id="season-name"
          type="text"
          value={value.seasonName}
          onChange={(e) => onChange({ seasonName: e.target.value })}
          placeholder={derivedName || 'e.g., Fall 2026'}
          className="max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          Auto-filled from the start date ({derivedName}). Override only
          if your league names seasons differently.
        </p>
      </div>
    </div>
  );
}
