/**
 * @fileoverview ScheduleWeekRow Component
 *
 * Single row in the schedule review table showing one week's details
 * Displays week number, date, conflicts, and action buttons
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { ConflictBadge } from './ConflictBadge';
import { getHighestSeverity } from '@/utils/conflictDetectionUtils';
import { parseLocalDate } from '@/utils/formatters';
import { isPlayWeekLocked } from '@/utils/scheduleDisplayUtils';
import type { ScheduleWeekRowProps } from '@/types/scheduleReview';

/**
 * ScheduleWeekRow Component
 *
 * Displays a single week in the schedule with:
 * - Week number or type (regular, playoffs, week-off)
 * - Date
 * - Status indicator (✓ Good or ⚠️ Conflicts)
 * - Conflict badges if any
 * - Action buttons (Skip/Un-Skip, Ignore)
 */
export const ScheduleWeekRow: React.FC<ScheduleWeekRowProps> = ({
  week,
  index,
  weekLabel,
  onToggleWeekOff,
  lockBeforeDate,
  allowLockedToggle = false,
}) => {
  const hasConflicts = week.conflicts.length > 0;
  const isWeekOff = week.type === 'week-off';
  const isPlayoffs = week.type === 'playoffs';
  // A season-end break is a blackout labelled "Season End Break" (label lives in
  // notes; falls back to weekName for fresh in-memory wizard weeks).
  const isSeasonEndBreak = (week.notes ?? week.weekName) === 'Season End Break';

  // Locked = a regular week already in the past. Position/number-free (no
  // week_name parsing) — see isPlayWeekLocked. No cutoff (setup wizard) = nothing
  // locks.
  const isWeekLocked = lockBeforeDate ? isPlayWeekLocked(week, lockBeforeDate) : false;

  // Determine highest severity conflict
  const highestSeverity = getHighestSeverity(week.conflicts);

  // Format date for display using timezone-safe parsing
  const displayDate = parseLocalDate(week.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const displayDateMobile = parseLocalDate(week.date).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });

  return (
    <tr
      className={`border-b ${
        isWeekOff
          ? 'bg-muted'
          : hasConflicts
          ? 'bg-warning/10'
          : 'hover:bg-muted'
      }`}
    >
      {/* Week Name — derived label (falls back to stored week_name in transition) */}
      <td className="py-3 px-4 text-sm lg:text-md">
        {weekLabel ?? week.weekName}
      </td>

      {/* Date */}
      <>
      <td className="hidden lg:block text-xs lg:text-md py-3 px-4 text-foreground">{displayDate}</td>
      <td className="lg:hidden text-xs lg:text-md py-3 px-4 text-foreground">{displayDateMobile}</td>
      </>

      {/* Status */}
      <td className="py-3 px px-4">
        {isWeekOff ? (
          <div className="w-full flex justify-center">
            <span className="hidden lg:block text-muted-foreground text-sm">🚫 Week Off</span>
            <span className="lg:hidden text-muted-foreground text-sm">🚫</span>
          </div>
        ) : hasConflicts ? (
          <div className="w-full flex justify-center">
            {highestSeverity === 'critical' && (
              <>
                <span className="hidden lg:block text-destructive font-medium">🔴 Critical</span>
                <span className="lg:hidden text-destructive font-medium">🔴</span>
              </>
            )}
            {highestSeverity === 'high' && (
              <>
                <span className="hidden lg:block text-warning font-medium">🟠 High</span>
                <span className="lg:hidden text-warning font-medium">🟠</span>
              </>
            )}
            {highestSeverity === 'medium' && (
              <>
                <span className="hidden lg:block text-warning font-medium">🟡 Medium</span>
                <span className="lg:hidden text-warning font-medium">🟡</span>
              </>
            )}
            {highestSeverity === 'low' && (
              <>
                <span className="hidden lg:block text-info font-medium">🔵 Low</span>
                <span className="lg:hidden text-info font-medium">🔵</span>
              </>
            )}
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <span className="hidden lg:block text-success font-medium">✓ Play</span>
            <span className="lg:hidden text-success font-medium">✓</span>
          </div>
        )}
      </td>

      {/* Conflicts - show for regular weeks and playoffs */}
      <td className="py-3 px lg:px-4">
        {hasConflicts && (week.type === 'regular' || week.type === 'playoffs') && (
          <div className="flex flex-col gap-2">
            {week.conflicts.map((conflict, i) => (
              <ConflictBadge key={i} conflict={conflict} />
            ))}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="py-3 px-4">
        {isWeekLocked && !allowLockedToggle ? (
          <span className="text-muted-foreground text-sm flex items-center gap-1">
            🔒 Week Completed
          </span>
        ) : (
          <>
            {/* When the caller opts into editing locked weeks (advisory-date edit
                page), still flag that this week is past/played so the toggle is a
                deliberate choice — the caller warns before applying. */}
            {isWeekLocked && allowLockedToggle && (
              <span className="block text-xs text-muted-foreground mb-1">🔒 played</span>
            )}
            <Button
              className="hidden lg:block"
              variant="outline"
              size="sm"
              onClick={() => onToggleWeekOff(index)}
            >
              {isSeasonEndBreak
                ? 'Remove Season End Break'
                : isPlayoffs
                ? 'Insert Season End Break'
                : isWeekOff
                ? 'Remove Week Off'
                : 'Insert Week Off'}
            </Button>
            <Button
              className="lg:hidden"
              variant="outline"
              size="sm"
              onClick={() => onToggleWeekOff(index)}
            >
              {isSeasonEndBreak
                ? 'No Break'
                : isPlayoffs
                ? 'Add Break'
                : isWeekOff
                ? 'Play'
                : 'Skip'}
            </Button>
          </>
        )}
      </td>
    </tr>
  );
};
