/**
 * @fileoverview Schedule Review Types
 *
 * Type definitions specific to the schedule review UI components
 */
import type { WeekEntry, ConflictFlag, ChampionshipEvent } from './season';
import type { Holiday } from '@/utils/holidayUtils';

/**
 * Props for ScheduleReview container component
 */
export interface ScheduleReviewProps {
  /** Initial schedule with conflicts */
  schedule: WeekEntry[];
  /** League day of week for conflict detection */
  leagueDayOfWeek: string;
  /** Season start date (used for recalculation) */
  seasonStartDate: string;
  /** Holidays for conflict recalculation */
  holidays: Holiday[];
  /** BCA championship dates */
  bcaChampionship?: ChampionshipEvent;
  /** APA championship dates */
  apaChampionship?: ChampionshipEvent;
  /** Number of playoff weeks to generate (0-4, default 1) */
  playoffWeeks?: number;
  /** Callback when schedule is modified */
  onScheduleChange: (updatedSchedule: WeekEntry[]) => void;
  /** Callback when user confirms final schedule - destination can be 'dashboard' or 'teams' */
  onConfirm: (destination: 'dashboard' | 'teams') => void;
  /** Callback to go back to previous step */
  onBack: () => void;
}

/**
 * Props for ScheduleWeekRow component
 */
export interface ScheduleWeekRowProps {
  /** Week data to display */
  week: WeekEntry;
  /** Index in schedule array */
  index: number;
  /**
   * Derived display label ("Week 5", "Christmas", "Playoffs") — never the stored
   * week_name. Built once by the parent from the full week list.
   */
  weekLabel?: string;
  /** Callback when insert/remove week-off is clicked */
  onToggleWeekOff: (index: number) => void;
  /**
   * Cutoff ISO date (normally today): regular weeks strictly before it render as
   * locked/played. Omitted (e.g. in the setup wizard) means nothing locks.
   * Replaces the old parsed-week-number comparison — see isPlayWeekLocked.
   */
  lockBeforeDate?: string;
  /**
   * When true, past/completed weeks still show the toggle (the caller warns before
   * applying). The active-season edit page opts in — dates are advisory, so an
   * operator may fix a past/played week. Setup leaves this off (default), keeping
   * past weeks hard-locked.
   */
  allowLockedToggle?: boolean;
}

/**
 * Props for ConflictBadge component
 */
export interface ConflictBadgeProps {
  /** Conflict to display */
  conflict: ConflictFlag;
}
