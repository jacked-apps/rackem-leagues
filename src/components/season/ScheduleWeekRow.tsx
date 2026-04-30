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
  onToggleWeekOff,
  currentPlayWeek,
}) => {
  const hasConflicts = week.conflicts.length > 0;
  const isWeekOff = week.type === 'week-off';
  const isPlayoffs = week.type === 'playoffs';
  const isSeasonEndBreak = week.weekName === 'Season End Break';

  /**
   * Helper function to extract play week number from weekName
   * E.g., "Week 3" -> 3, "Christmas" -> null
   */
  const getPlayWeekNumber = (weekName: string): number | null => {
    const match = weekName.match(/^Week (\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Determine if this week is locked (already played)
  const playWeekNumber = getPlayWeekNumber(week.weekName);
  const isWeekLocked =
    playWeekNumber !== null &&
    currentPlayWeek !== undefined &&
    playWeekNumber <= currentPlayWeek;

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
          ? 'bg-orange-50'
          : 'hover:bg-muted'
      }`}
    >
      {/* Week Name */}
      <td className="py-3 px-4 text-sm lg:text-md">
        {week.weekName}
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
                <span className="hidden lg:block text-red-600 font-medium">🔴 Critical</span>
                <span className="lg:hidden text-red-600 font-medium">🔴</span>
              </>
            )}
            {highestSeverity === 'high' && (
              <>
                <span className="hidden lg:block text-orange-600 font-medium">🟠 High</span>
                <span className="lg:hidden text-orange-600 font-medium">🟠</span>
              </>
            )}
            {highestSeverity === 'medium' && (
              <>
                <span className="hidden lg:block text-yellow-600 font-medium">🟡 Medium</span>
                <span className="lg:hidden text-yellow-600 font-medium">🟡</span>
              </>
            )}
            {highestSeverity === 'low' && (
              <>
                <span className="hidden lg:block text-blue-600 font-medium">🔵 Low</span>
                <span className="lg:hidden text-blue-600 font-medium">🔵</span>
              </>
            )}
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <span className="hidden lg:block text-green-600 font-medium">✓ Play</span>
            <span className="lg:hidden text-green-600 font-medium">✓</span>
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
        {isWeekLocked ? (
          <span className="text-muted-foreground text-sm flex items-center gap-1">
            🔒 Week Completed
          </span>
        ) : (
          <>
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
