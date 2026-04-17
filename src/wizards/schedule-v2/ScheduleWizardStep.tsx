/**
 * @fileoverview ScheduleWizardStep — wraps ScheduleReview for the wizard.
 *
 * On "Save & Continue", if a schedule is already saved for this season,
 * asks the user whether to replace it with the current edits or keep the
 * existing one. This edge case should only hit devs / resumed flows, so
 * we keep it to a simple two-choice dialog (replace vs keep).
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScheduleReview } from '@/components/season/ScheduleReview';
import { HolidayFilterToggle } from '@/components/season/HolidayFilterToggle';
import { generateSchedule } from '@/utils/scheduleUtils';
import { detectScheduleConflicts } from '@/utils/conflictDetectionUtils';
import { fetchHolidaysForSeason, filterHolidaysByType } from '@/utils/holidayUtils';
import { parseLocalDate } from '@/utils/formatters';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useExistingWeeks } from './useExistingWeeks';
import type { WizardStepProps } from '@/components/wizard';
import type { WeekEntry } from '@/types/season';
import type { ScheduleWizardFormData } from './scheduleWizardTypes';

export function ScheduleWizardStep({
  value,
  onChange,
  formData,
  onNext,
}: WizardStepProps<WeekEntry[] | undefined, ScheduleWizardFormData>) {
  const [showAllHolidays, setShowAllHolidays] = useState(false);
  const [pendingKeepAdvance, setPendingKeepAdvance] = useState(false);
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const ctx = (formData as Record<string, unknown>)._flowContext as {
    leagueStartDate?: string;
    dayOfWeek?: string;
    seasonLength?: number;
    playoffWeeks?: number;
    seasonId?: string;
  } | undefined;

  const startDate = ctx?.leagueStartDate ?? '';
  const dayOfWeek = ctx?.dayOfWeek ?? 'monday';
  const seasonLength = ctx?.seasonLength ?? 16;
  const playoffWeeks = ctx?.playoffWeeks ?? 1;

  const { data: existingWeeks } = useExistingWeeks(ctx?.seasonId);
  const existingCount = existingWeeks?.count ?? 0;

  const allHolidays = useMemo(() => {
    if (!startDate) return [];
    return fetchHolidaysForSeason(parseLocalDate(startDate), seasonLength);
  }, [startDate, seasonLength]);

  const filteredHolidays = useMemo(
    () => filterHolidaysByType(allHolidays, showAllHolidays),
    [allHolidays, showAllHolidays],
  );

  const initialSchedule = useMemo(() => {
    if (!startDate) return [];
    const schedule = generateSchedule(
      parseLocalDate(startDate), dayOfWeek, seasonLength, [], 1, playoffWeeks,
    );
    return detectScheduleConflicts(schedule, filteredHolidays, undefined, undefined, dayOfWeek);
  }, [startDate, dayOfWeek, seasonLength, playoffWeeks, filteredHolidays]);

  // After "Keep Existing" fires onChange([]), wait for the empty value to
  // propagate through state, then call onNext. This avoids a stale closure
  // in useWizardShell's handleNext that would otherwise read the old schedule.
  useEffect(() => {
    if (pendingKeepAdvance && Array.isArray(value) && value.length === 0) {
      setPendingKeepAdvance(false);
      onNext();
    }
  }, [pendingKeepAdvance, value, onNext]);

  if (!startDate) {
    return <p className="text-red-600">Missing start date from league setup.</p>;
  }

  const handleConfirm = async (destination: 'dashboard' | 'teams') => {
    if (destination === 'dashboard') {
      const orgId = window.location.pathname.split('/create-league-v2/')[1]?.split('/')[0]?.split('?')[0];
      navigate(`/operator-dashboard/${orgId ?? ''}`);
      return;
    }

    if (existingCount > 0) {
      const replace = await confirm({
        title: 'Schedule already saved',
        message: `This season already has a ${existingCount}-week schedule. Replace it with your changes, or keep the saved one and continue?`,
        confirmText: 'Replace with New',
        cancelText: 'Keep Existing',
        confirmVariant: 'destructive',
      });
      if (!replace) {
        onChange([]); // empty signals "skip save" in the stage handler
        setPendingKeepAdvance(true);
        return;
      }
    }

    onNext();
  };

  return (
    <div className="space-y-4 overflow-x-hidden">
      <HolidayFilterToggle showAll={showAllHolidays} onChange={setShowAllHolidays} />
      <ScheduleReview
        schedule={value && value.length > 0 ? value : initialSchedule}
        leagueDayOfWeek={dayOfWeek}
        seasonStartDate={startDate}
        holidays={filteredHolidays}
        playoffWeeks={playoffWeeks}
        currentPlayWeek={0}
        onScheduleChange={onChange}
        onConfirm={handleConfirm}
        onBack={() => navigate(-1)}
      />
      {ConfirmDialogComponent}
    </div>
  );
}
