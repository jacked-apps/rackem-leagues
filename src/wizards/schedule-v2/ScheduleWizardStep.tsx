/**
 * @fileoverview ScheduleWizardStep — wraps existing ScheduleReview for the wizard
 *
 * Reads season length + playoff weeks from flow context, generates schedule,
 * filters holidays via HolidayFilterToggle, delegates UI to ScheduleReview.
 * Wires ScheduleReview's existing buttons to wizard navigation actions.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScheduleReview } from '@/components/season/ScheduleReview';
import { HolidayFilterToggle } from '@/components/season/HolidayFilterToggle';
import { generateSchedule } from '@/utils/scheduleUtils';
import { detectScheduleConflicts } from '@/utils/conflictDetectionUtils';
import { fetchHolidaysForSeason, filterHolidaysByType } from '@/utils/holidayUtils';
import { parseLocalDate } from '@/utils/formatters';
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

  // Read context from the flow (injected by WizardFlowStageRenderer)
  const ctx = (formData as Record<string, unknown>)._flowContext as {
    leagueStartDate?: string;
    dayOfWeek?: string;
    seasonLength?: number;
    playoffWeeks?: number;
  } | undefined;

  const startDate = ctx?.leagueStartDate ?? '';
  const dayOfWeek = ctx?.dayOfWeek ?? 'monday';
  const seasonLength = ctx?.seasonLength ?? 16;
  const playoffWeeks = ctx?.playoffWeeks ?? 1;

  // Fetch all holidays once, then filter based on toggle
  const allHolidays = useMemo(() => {
    if (!startDate) return [];
    return fetchHolidaysForSeason(parseLocalDate(startDate), seasonLength);
  }, [startDate, seasonLength]);

  const filteredHolidays = useMemo(
    () => filterHolidaysByType(allHolidays, showAllHolidays),
    [allHolidays, showAllHolidays],
  );

  // Generate initial schedule with filtered holidays
  const initialSchedule = useMemo(() => {
    if (!startDate) return [];
    const schedule = generateSchedule(
      parseLocalDate(startDate),
      dayOfWeek,
      seasonLength,
      [],
      1,
      playoffWeeks,
    );
    return detectScheduleConflicts(schedule, filteredHolidays, undefined, undefined, dayOfWeek);
  }, [startDate, dayOfWeek, seasonLength, playoffWeeks, filteredHolidays]);

  const navigate = useNavigate();

  if (!startDate) {
    return <p className="text-red-600">Missing start date from league setup.</p>;
  }

  // Save & Exit → go to dashboard. Save & Add Teams → advance the wizard.
  const handleConfirm = (destination: 'dashboard' | 'teams') => {
    if (destination === 'dashboard') {
      const orgId = window.location.pathname.split('/create-league-v2/')[1]?.split('/')[0]?.split('?')[0];
      navigate(`/operator-dashboard/${orgId ?? ''}`);
    } else {
      onNext();
    }
  };

  return (
    <div className="space-y-4 overflow-x-hidden">
      <HolidayFilterToggle showAll={showAllHolidays} onChange={setShowAllHolidays} />

      <ScheduleReview
        schedule={value ?? initialSchedule}
        leagueDayOfWeek={dayOfWeek}
        seasonStartDate={startDate}
        holidays={filteredHolidays}
        playoffWeeks={playoffWeeks}
        currentPlayWeek={0}
        onScheduleChange={onChange}
        onConfirm={handleConfirm}
        onBack={() => navigate(-1)}
      />
    </div>
  );
}
