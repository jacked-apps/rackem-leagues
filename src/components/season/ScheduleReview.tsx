/**
 * @fileoverview ScheduleReview Component
 *
 * Smart container component for reviewing and modifying the generated season schedule
 * Manages schedule state, conflict detection, and week toggling logic
 */
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { ScheduleReviewTable } from './ScheduleReviewTable';
import { InfoButton } from '../InfoButton';

const WeekOffReasonModal = lazy(() => import('@/components/modals/WeekOffReasonModal').then(m => ({ default: m.WeekOffReasonModal })));
import { generateSchedule } from '@/utils/scheduleUtils';
import { detectScheduleConflicts } from '@/utils/conflictDetectionUtils';
import { parseLocalDate } from '@/utils/formatters';
import { STORAGE_KEYS } from '@/constants/scheduleConflicts';
import type { ScheduleReviewProps } from '@/types/scheduleReview';
import type { WeekEntry } from '@/types/season';

/**
 * ScheduleReview Component
 *
 * Container component that:
 * - Displays the generated schedule with conflicts
 * - Allows skipping weeks (recalculates dates)
 * - Allows ignoring conflicts
 * - Provides navigation (Back/Confirm)
 */
export const ScheduleReview: React.FC<ScheduleReviewProps> = ({
  schedule: initialSchedule,
  leagueDayOfWeek,
  seasonStartDate,
  holidays,
  bcaChampionship,
  apaChampionship,
  currentPlayWeek = 0,
  playoffWeeks = 1,
  onScheduleChange,
  onConfirm,
  onBack,
}) => {
  const [schedule, setSchedule] = useState<WeekEntry[]>(() => {
    // Try to restore schedule from localStorage first
    const stored = localStorage.getItem(STORAGE_KEYS.SCHEDULE_REVIEW);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return initialSchedule;
      }
    }
    return initialSchedule;
  });

  const [blackoutWeeks, setBlackoutWeeks] = useState<WeekEntry[]>(() => {
    // Try to restore blackout weeks from localStorage
    const stored = localStorage.getItem(STORAGE_KEYS.BLACKOUT_WEEKS);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [addSeasonEndBreak, setAddSeasonEndBreak] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingWeekIndex, setPendingWeekIndex] = useState<number | null>(null);

  // Track if we've loaded saved data to prevent regenerating on initial load
  const [hasLoadedSavedData, setHasLoadedSavedData] = useState(false);

  // Store the original season length (count of regular weeks from initial schedule)
  const [originalSeasonLength, setOriginalSeasonLength] = useState(() => {
    return initialSchedule.filter(w => w.type === 'regular').length;
  });

  // Update originalSeasonLength when initialSchedule changes (on first load)
  useEffect(() => {
    const regularCount = initialSchedule.filter(w => w.type === 'regular').length;
    if (regularCount > 0 && originalSeasonLength === 0) {
      setOriginalSeasonLength(regularCount);
    }
  }, [initialSchedule, originalSeasonLength]);

  // Update local schedule when prop changes (but only if localStorage is empty)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SCHEDULE_REVIEW);

    if (!stored) {
      setSchedule(initialSchedule);
      setHasLoadedSavedData(false);
    } else {
      // We loaded saved schedule AND blackouts - don't regenerate
      setHasLoadedSavedData(true);
    }
  }, [initialSchedule]);

  // Save schedule to localStorage whenever it changes
  useEffect(() => {
    if (schedule.length > 0) {
      localStorage.setItem(STORAGE_KEYS.SCHEDULE_REVIEW, JSON.stringify(schedule));
    }
  }, [schedule]);

  // Save blackout weeks to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BLACKOUT_WEEKS, JSON.stringify(blackoutWeeks));
  }, [blackoutWeeks]);

  /**
   * Regenerates the schedule with current blackout weeks
   */
  const regenerateSchedule = () => {
    // Use the original season length to ensure we always generate the same number of regular weeks
    const newSchedule = generateSchedule(
      parseLocalDate(seasonStartDate),
      leagueDayOfWeek,
      originalSeasonLength,
      blackoutWeeks,
      addSeasonEndBreak,
      playoffWeeks
    );

    // Detect conflicts using shared utility
    const scheduleWithConflicts = detectScheduleConflicts(
      newSchedule,
      holidays,
      bcaChampionship,
      apaChampionship,
      leagueDayOfWeek
    );

    setSchedule(scheduleWithConflicts);
  };

  /**
   * Extracts holiday name from conflict name by removing timing description
   * Example: "Christmas (Saturday 2 days before)" -> "Christmas"
   */
  const extractHolidayName = (conflictName: string): string => {
    const parenIndex = conflictName.indexOf(' (');
    return parenIndex !== -1 ? conflictName.substring(0, parenIndex) : conflictName;
  };

  /**
   * Handler for inserting/removing week-off
   */
  const handleToggleWeekOff = (index: number) => {
    const week = displaySchedule[index];

    // Clear the saved data flag to ensure regeneration happens
    setHasLoadedSavedData(false);

    // Special handling for Season End Break - decrement count
    if (week.weekName === 'Season End Break') {
      setAddSeasonEndBreak(Math.max(0, addSeasonEndBreak - 1));
      return;
    }

    // Special handling for Playoffs - increment Season End Break count
    if (week.type === 'playoffs') {
      setAddSeasonEndBreak(addSeasonEndBreak + 1);
      return;
    }

    // If it's already a week-off, remove it from blackout
    if (week.type === 'week-off') {
      const updatedBlackout = blackoutWeeks.filter(b => b.date !== week.date);
      setBlackoutWeeks(updatedBlackout);
      // Schedule will regenerate via useEffect
      return;
    }

    // If week has conflicts, use the first conflict's name (without timing description)
    if (week.conflicts.length > 0) {
      const conflict = week.conflicts[0];
      const holidayName = extractHolidayName(conflict.name);
      const blackoutEntry: WeekEntry = {
        weekNumber: 0, // Not used for blackouts
        weekName: holidayName,
        date: week.date,
        type: 'week-off',
        conflicts: [],
      };
      setBlackoutWeeks([...blackoutWeeks, blackoutEntry]);
      // Schedule will regenerate via useEffect
    } else {
      // No conflicts - show modal for custom reason
      setPendingWeekIndex(index);
      setModalOpen(true);
    }
  };

  /**
   * Handler for modal confirmation with custom reason
   */
  const handleModalConfirm = (reason: string) => {
    if (pendingWeekIndex === null) return;

    // IMPORTANT: Use displaySchedule (not schedule) since pendingWeekIndex comes from the combined/sorted display
    const week = displaySchedule[pendingWeekIndex];
    const blackoutEntry: WeekEntry = {
      weekNumber: 0,
      weekName: reason,
      date: week.date,
      type: 'week-off',
      conflicts: [],
    };

    setBlackoutWeeks([...blackoutWeeks, blackoutEntry]);
    setModalOpen(false);
    setPendingWeekIndex(null);
  };

  /**
   * Handler for modal cancel
   */
  const handleModalCancel = () => {
    setModalOpen(false);
    setPendingWeekIndex(null);
  };

  // Regenerate schedule whenever blackoutWeeks or addSeasonEndBreak changes
  // BUT skip the first regeneration if we loaded saved data
  useEffect(() => {
    // Skip regeneration on initial load if we loaded saved data
    // BUT still run conflict detection on the loaded schedule
    if (hasLoadedSavedData) {
      // Make sure we have all required props before running conflict detection
      if (!seasonStartDate || !leagueDayOfWeek || schedule.length === 0) {
        // Don't clear the flag yet - let it try again when props are ready
        return;
      }

      // Run conflict detection on the existing loaded schedule
      const scheduleWithConflicts = detectScheduleConflicts(
        schedule,
        holidays,
        bcaChampionship,
        apaChampionship,
        leagueDayOfWeek
      );

      setSchedule(scheduleWithConflicts);
      setHasLoadedSavedData(false); // Clear flag so future changes DO trigger regeneration
      return;
    }

    // Only regenerate if we have initial data loaded
    if (schedule.length > 0 && seasonStartDate) {
      regenerateSchedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blackoutWeeks, addSeasonEndBreak, seasonStartDate, leagueDayOfWeek, holidays, bcaChampionship, apaChampionship]);

  /**
   * Combine schedule and blackout weeks for display
   * Sort by date to show chronological order
   * Deduplicate: if a date appears in both arrays, keep only the blackout version
   */
  const displaySchedule = (() => {
    // First, create a Set of blackout dates for quick lookup
    const blackoutDates = new Set(blackoutWeeks.map(b => b.date));

    // Filter out any regular weeks that conflict with blackout dates
    const filteredSchedule = schedule.filter(week => !blackoutDates.has(week.date));

    // Combine filtered schedule with blackouts
    const combined = [...filteredSchedule, ...blackoutWeeks];

    // Sort by date
    return combined.sort((a, b) => a.date.localeCompare(b.date));
  })();

  /**
   * Notify parent component whenever the complete schedule changes
   * This ensures SeasonCreationWizard has the correct combined schedule to save
   */
  useEffect(() => {
    if (displaySchedule.length > 0 && onScheduleChange) {
      onScheduleChange(displaySchedule);
    }
  }, [displaySchedule.length, schedule.length, blackoutWeeks.length, onScheduleChange]);

  /**
   * Counts total conflicts across all weeks
   */
  const totalConflicts = displaySchedule.reduce(
    (sum, week) => sum + week.conflicts.length,
    0
  );

  return (
    <div className="flex flex-col min-h-full bg-card">
      <div className="flex-1 flex flex-col p-8">
        <div className="w-full mx-auto px-4">
          {/* Header */}
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Review Season Schedule
          </h2>
          <p className="text-muted-foreground mb-4">
            Review your schedule for conflicts with holidays and championships.
            You can skip weeks or ignore conflicts as needed.
          </p>

          <div className="mb-6">
            <InfoButton
              title="How to Choose Weeks to Take Off"
              label="How to Choose Weeks to Take Off"
            >
              <div className="space-y-3">
                <p>
                  Major holidays should always be taken off as a significant amount of people travel during these holidays.
                </p>
                <p>
                  BCA and APA championships usually need to be taken off for the same reason, and we like to encourage these trips as well.
                </p>
                <p>
                  Smaller holidays are up to you and your players. Remember you can change your mind mid-season and can edit this schedule up until that week is played.
                </p>
                <p>
                  You can also schedule weeks off for local events that may interfere with the schedule.
                </p>
                <p>
                  We try to give you as much control over the season as possible. You are not charged for weeks taken off, only weeks played within the season.
                </p>
              </div>
            </InfoButton>
          </div>

          {/* Conflict Summary */}
          {totalConflicts > 0 && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-orange-800 font-medium">
                ⚠️ {totalConflicts} conflict{totalConflicts > 1 ? 's' : ''}{' '}
                detected
              </p>
              <p className="text-orange-700 text-sm mt-1">
                Review the conflicts below and either skip the week or ignore
                the conflict.
              </p>
            </div>
          )}

          {/* Schedule Table */}
          <ScheduleReviewTable
            schedule={displaySchedule}
            onToggleWeekOff={handleToggleWeekOff}
            currentPlayWeek={currentPlayWeek}
          />

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              loadingText="none"
            >
              Previous
            </Button>

            <div className="flex-1 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onConfirm('dashboard')}
                className="flex-1"
                loadingText="Saving..."
              >
                Save & Exit
              </Button>

              <Button
                type="button"
                onClick={() => onConfirm('teams')}
                className="flex-1"
                style={{ backgroundColor: '#2563eb', color: 'white' }}
                loadingText="Saving..."
              >
                Save & Continue →
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Week Off Reason Modal */}
      <Suspense fallback={null}>
        <WeekOffReasonModal
          isOpen={modalOpen}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
        />
      </Suspense>
    </div>
  );
};
