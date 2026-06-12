/**
 * @fileoverview ScheduleReviewTable Component
 *
 * Table wrapper component for schedule review
 * Displays headers and maps schedule entries to ScheduleWeekRow components
 */
import React from 'react';
import { ScheduleWeekRow } from './ScheduleWeekRow';
import type { WeekEntry } from '@/types/season';

/**
 * Props for ScheduleReviewTable component
 */
interface ScheduleReviewTableProps {
  /** Array of week entries to display */
  schedule: WeekEntry[];
  /** Callback when insert/remove week-off is clicked */
  onToggleWeekOff: (index: number) => void;
  /** Current play week number (locks editing of earlier weeks) */
  currentPlayWeek?: number;
  /** Pass-through: when true, past/completed weeks still show the toggle (caller warns). */
  allowLockedToggle?: boolean;
}

/**
 * ScheduleReviewTable Component
 *
 * Simple presentation component that renders a table with headers
 * and maps schedule entries to ScheduleWeekRow components
 */
export const ScheduleReviewTable: React.FC<ScheduleReviewTableProps> = ({
  schedule,
  onToggleWeekOff,
  currentPlayWeek,
  allowLockedToggle = false,
}) => {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full bg-card border border-border rounded-lg">
        <thead className="bg-muted border-b border-border">
          <tr>
            <th className="py-3 px-4 text-center text-sm font-semibold text-foreground">
              Week
            </th>
            <th className="py-3 px-4 text-center text-sm font-semibold text-foreground">
              Date
            </th>
            <th className="hidden lg:block py-3 px-4 text-center text-sm font-semibold text-foreground">
              Status
            </th>
            <th className="lg:hidden py-3 px-4 text-center text-sm font-semibold text-foreground">
            {' '}
            </th>
            <th className="py-3 px-4 text-center text-sm font-semibold text-foreground">
              Conflicts
            </th>
            <th className="py-3 px-4 text-center text-sm font-semibold text-foreground w-48">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((week, index) => (
            <ScheduleWeekRow
              key={`week-${week.weekName}-${week.date}`}
              week={week}
              index={index}
              onToggleWeekOff={onToggleWeekOff}
              currentPlayWeek={currentPlayWeek}
              allowLockedToggle={allowLockedToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
