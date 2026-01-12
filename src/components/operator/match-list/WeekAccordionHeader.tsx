/**
 * @fileoverview Week Accordion Header Component
 *
 * Displays the header content for a week accordion item in the Match List page.
 * Shows week name, date, and completion status with visual indicators.
 *
 * Status indicators:
 * - Green (complete): All matches in week are completed
 * - Yellow (in progress): Some matches completed
 * - Gray (scheduled): No matches started
 * - Purple "TBA": Playoff week with no matches yet
 */

import { parseLocalDate } from '@/utils/formatters';

interface WeekAccordionHeaderProps {
  /** Week display name (e.g., "Week 1", "Playoffs") */
  weekName: string;
  /** ISO date string for the week */
  scheduledDate: string;
  /** Number of completed matches */
  completedCount: number;
  /** Total number of matches in the week */
  totalCount: number;
  /** Whether this is a playoff week */
  isPlayoffs: boolean;
}

/**
 * Week Accordion Header Component
 *
 * Renders the accordion trigger content showing week info and status.
 * Uses color-coded status indicators for quick visual scanning.
 */
export function WeekAccordionHeader({
  weekName,
  scheduledDate,
  completedCount,
  totalCount,
  isPlayoffs,
}: WeekAccordionHeaderProps) {
  // Format the date for display
  const formattedDate = parseLocalDate(scheduledDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Determine status indicator
  const getStatusIndicator = () => {
    // Playoff weeks with no matches show TBA
    if (isPlayoffs && totalCount === 0) {
      return {
        icon: null,
        text: 'TBA',
        className: 'text-purple-600 font-medium',
      };
    }

    // Calculate completion status
    if (totalCount === 0) {
      return {
        icon: '⚪',
        text: '0/0',
        className: 'text-gray-500',
      };
    }

    if (completedCount === totalCount) {
      return {
        icon: '🟢',
        text: `${completedCount}/${totalCount}`,
        className: 'text-green-600',
      };
    }

    if (completedCount > 0) {
      return {
        icon: '🟡',
        text: `${completedCount}/${totalCount}`,
        className: 'text-yellow-600',
      };
    }

    return {
      icon: '⚪',
      text: `${completedCount}/${totalCount}`,
      className: 'text-gray-500',
    };
  };

  const status = getStatusIndicator();

  return (
    <div className="flex items-center justify-between w-full pr-4">
      {/* Week name and date */}
      <div className="flex items-center gap-3">
        <span className={`font-semibold ${isPlayoffs ? 'text-purple-700' : 'text-gray-900'}`}>
          {weekName}
        </span>
        <span className="text-sm text-gray-500">
          {formattedDate}
        </span>
      </div>

      {/* Status indicator */}
      <div className={`flex items-center gap-2 text-sm ${status.className}`}>
        {status.icon && <span>{status.icon}</span>}
        <span>{status.text}</span>
      </div>
    </div>
  );
}
