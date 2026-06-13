/**
 * @fileoverview Season Schedule Manager
 *
 * Allows operators to manage blackout weeks (holidays/breaks) for existing seasons.
 * Operators can add or remove blackout weeks for future dates only.
 * Past weeks (already played) cannot be modified.
 */
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { ScheduleReviewTable } from '@/components/season/ScheduleReviewTable';
import { InfoButton } from '@/components/InfoButton';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { applyBlackoutReflow, restoreScheduleSnapshot, type ScheduleSnapshot } from '@/utils/scheduleReflowApply';
import type { ReflowAction } from '@/utils/scheduleReflow';
import { isPastOrPlayed, decideToggle } from '@/utils/scheduleToggle';

const WeekOffReasonModal = lazy(() => import('@/components/modals/WeekOffReasonModal').then(m => ({ default: m.WeekOffReasonModal })));
import type { WeekEntry, ChampionshipEvent } from '@/types/season';
import type { League } from '@/types/league';
import { formatLocalDate, parseLocalDate } from '@/utils/formatters';
import { fetchHolidaysForSeason } from '@/utils/holidayUtils';
import { detectScheduleConflicts, extractHolidayName } from '@/utils/conflictDetectionUtils';
import { fetchChampionshipDateOptions, type ChampionshipDateOption } from '@/utils/tournamentUtils';

interface SeasonData {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  season_length: number;
  status: 'active' | 'upcoming' | 'completed';
}

/**
 * Season Schedule Manager Component
 *
 * Features:
 * - Load existing season_weeks from database
 * - Display schedule in table format
 * - Allow adding blackout weeks for future dates
 * - Allow removing blackout weeks that haven't been played yet
 * - Prevent editing past weeks
 * - Save changes back to database
 */
export const SeasonScheduleManager: React.FC = () => {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [schedule, setSchedule] = useState<WeekEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWeekOffModal, setShowWeekOffModal] = useState(false);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  // Pre-filled reason for the week-off modal — the conflict's name when the
  // selected week already carries a conflict flag, else blank.
  const [weekOffInitialReason, setWeekOffInitialReason] = useState('');
  // Pre-edit snapshot, captured on the first change. Non-null === the operator has
  // unsaved changes they can revert. Save just clears it; Revert restores it.
  const [snapshot, setSnapshot] = useState<ScheduleSnapshot | null>(null);
  // One-time heads-up shown before the first edit, explaining that changes save as
  // you go and leaving the page drops the ability to revert.
  const [infoShown, setInfoShown] = useState(false);

  /**
   * Load league, season, and existing schedule from the database.
   *
   * Extracted into a callback so it can be re-run after each re-flow apply — every
   * blackout add/remove commits immediately and then reloads the fresh schedule
   * (no staged "Save" model).
   */
  const loadSchedule = useCallback(async () => {
      if (!leagueId || !seasonId) {
        setError('Missing league or season ID');
        setLoading(false);
        return;
      }

      try {
        // Fetch league
        const { data: leagueData, error: leagueError } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', leagueId)
          .single();

        if (leagueError) throw leagueError;
        setLeague(leagueData);

        // Fetch season
        const { data: seasonData, error: seasonError } = await supabase
          .from('seasons')
          .select('id, season_name, start_date, end_date, season_length, status')
          .eq('id', seasonId)
          .single();

        if (seasonError) throw seasonError;
        setSeason(seasonData);

        // Fetch season weeks
        const { data: weeksData, error: weeksError } = await supabase
          .from('season_weeks')
          .select('*')
          .eq('season_id', seasonId)
          .order('scheduled_date', { ascending: true });

        if (weeksError) throw weeksError;

        // Transform database weeks into WeekEntry format
        const transformedSchedule: WeekEntry[] = weeksData.map((week) => {
          // Map database week_type to UI type
          let type: 'regular' | 'playoffs' | 'week-off' = 'regular';
          if (week.week_type === 'playoffs') {
            type = 'playoffs';
          } else if (week.week_type === 'blackout' || week.week_type === 'season_end_break') {
            type = 'week-off';
          }

          return {
            weekNumber: week.week_type === 'regular' ? extractWeekNumber(week.week_name) : 0,
            weekName: week.week_name,
            date: week.scheduled_date,
            type,
            conflicts: [],
            dbId: week.id, // Store DB ID for updates/deletes
            weekCompleted: week.week_completed,
            dbWeekType: week.week_type, // Store original DB week_type
          };
        });

        // Run conflict detection on the loaded schedule
        const startDate = parseLocalDate(seasonData.start_date);
        const seasonLength = seasonData.season_length || 16;
        const holidays = fetchHolidaysForSeason(startDate, seasonLength);

        // Championship conflict dates come from the SOURCE-OF-TRUTH date table
        // (`championship_date_options`), NOT from the schedule's own "week-off"
        // weeks. Deriving from the off-weeks meant that if the dates were ever
        // corrected after the schedule was built (or any edit re-ran this), the
        // flags echoed the stale off-weeks — e.g. APA flagged on 6/28–8/2 when
        // the real dates are 8/04–8/15. `[0]` is the dev-verified / top-voted
        // option for the relevant year (see fetchChampionshipDateOptions).
        const [bcaOptions, apaOptions] = await Promise.all([
          fetchChampionshipDateOptions('BCA'),
          fetchChampionshipDateOptions('APA'),
        ]);
        // Dates are stored as full ISO timestamps (`...T04:00:00Z`); strip the
        // time so downstream `parseLocalDate` (which expects YYYY-MM-DD) is happy.
        const toChampionship = (
          opt: ChampionshipDateOption | undefined,
        ): ChampionshipEvent | undefined =>
          opt
            ? {
                start: opt.start_date.split('T')[0],
                end: opt.end_date.split('T')[0],
                ignored: false,
              }
            : undefined;
        const bcaChampionship = toChampionship(bcaOptions[0]);
        const apaChampionship = toChampionship(apaOptions[0]);

        const leagueDayOfWeek = leagueData?.day_of_week || 'tuesday';

        // Run conflict detection
        const scheduleWithConflicts = detectScheduleConflicts(
          transformedSchedule,
          holidays,
          bcaChampionship,
          apaChampionship,
          leagueDayOfWeek
        );

        setSchedule(scheduleWithConflicts);
      } catch (err) {
        logger.error('Error loading schedule', { error: err instanceof Error ? err.message : String(err) });
        setError('Failed to load season schedule');
      } finally {
        setLoading(false);
      }
  }, [leagueId, seasonId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  /**
   * Extract week number from week name (e.g., "Week 5" -> 5)
   */
  const extractWeekNumber = (weekName: string): number => {
    const match = weekName.match(/Week (\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  /**
   * Get current week number (weeks that have been completed)
   * Used to prevent editing past weeks
   */
  const getCurrentPlayWeek = (): number => {
    const today = formatLocalDate(new Date());
    let currentWeek = 0;

    for (const week of schedule) {
      if (week.type === 'regular' && week.date < today) {
        currentWeek = Math.max(currentWeek, week.weekNumber);
      }
    }

    return currentWeek;
  };

  /**
   * Apply a re-flow action (add/remove a skip) to the database, then reload the
   * fresh schedule. Each toggle commits immediately — there is no staged "Save".
   * Matches are never touched; only week dates shift (see scheduleReflowApply.ts).
   */
  /**
   * Capture the current schedule as a revertable snapshot (play rows by id, plus
   * skip rows and the season end date). Taken from in-memory state BEFORE the first
   * change applies.
   */
  const buildSnapshot = (): ScheduleSnapshot | null => {
    if (!season) return null;
    return {
      weeks: schedule
        .filter((w) => w.dbId && w.dbWeekType)
        .map((w) => ({
          id: w.dbId as string,
          date: w.date,
          weekType: w.dbWeekType as ScheduleSnapshot['weeks'][number]['weekType'],
          weekName: w.weekName,
        })),
      endDate: season.end_date,
    };
  };

  const applyReflow = async (action: ReflowAction) => {
    if (!seasonId || processing) return;
    // Capture the starting point once, before the very first change applies.
    const pending = snapshot ?? buildSnapshot();
    setProcessing(true);
    setError(null);

    const result = await applyBlackoutReflow(seasonId, action);
    if (result.success) {
      if (!snapshot && pending) setSnapshot(pending);
      toast.success('Schedule updated');
      await loadSchedule();
    } else {
      toast.error(result.error ?? 'Could not update the schedule. Please try again.');
    }
    setProcessing(false);
  };

  /**
   * Revert every change back to the snapshot captured on the first edit.
   */
  const handleRevert = async () => {
    if (!seasonId || !snapshot || processing) return;
    setProcessing(true);
    setError(null);

    const result = await restoreScheduleSnapshot(seasonId, snapshot);
    if (result.success) {
      setSnapshot(null);
      toast.success('Reverted to the starting schedule');
      await loadSchedule();
    } else {
      toast.error(result.error ?? 'Could not revert. Please try again.');
    }
    setProcessing(false);
  };

  /**
   * Finalize: changes are already saved, so this just clears the snapshot (drops the
   * ability to revert) and returns to the league.
   */
  const handleDone = () => {
    setSnapshot(null);
    toast.success('Schedule saved');
    navigate(`/league/${leagueId}`);
  };

  /**
   * Handle a week-off toggle from a schedule row.
   *
   * Dates are advisory (players can play any match any time), so editing a past or
   * already-played week is WARNED but ALLOWED, never blocked. A skip week (blackout
   * or season-end break) is removed; a play week is turned into a skip — playoffs get
   * a season-end break, regular weeks open the reason modal for a blackout.
   */
  const handleToggleWeekOff = async (index: number) => {
    if (processing) return;
    const week = schedule[index];
    if (!week?.dbId) return;

    // One-time heads-up before the very first edit of this session.
    if (!infoShown) {
      const ok = await confirm({
        title: 'Changes save automatically',
        message:
          'Each adjustment you make to the schedule saves automatically. If you ' +
          'navigate away from this page for any reason, you\'ll lose the ability to ' +
          'revert back to the schedule you started with. (You can always re-edit the ' +
          'schedule back to where it was.)',
        confirmText: 'Got it',
      });
      if (!ok) return;
      setInfoShown(true);
    }

    const toggleWeek = {
      date: week.date,
      weekCompleted: week.weekCompleted === true,
      dbWeekType: week.dbWeekType,
    };

    // Warn-but-allow for past / already-played weeks (dates are advisory).
    const today = formatLocalDate(new Date());
    if (isPastOrPlayed(toggleWeek, today)) {
      const ok = await confirm({
        title: 'Edit a past week?',
        message:
          'This week is in the past or already played. Players may have already used ' +
          'these dates. You can still re-flow the schedule — just double-check the result.',
        confirmText: 'Re-flow anyway',
      });
      if (!ok) return;
    }

    const decision = decideToggle(toggleWeek);
    if (decision.action === 'remove') {
      await applyReflow({ kind: 'remove', date: week.date });
    } else if (decision.action === 'add') {
      await applyReflow({
        kind: 'add',
        date: week.date,
        reason: decision.reason,
        skipType: decision.skipType,
      });
    } else {
      // prompt-blackout: a regular week needs an operator reason first. If the
      // week already carries a conflict flag (e.g. a holiday), seed the modal with
      // that name so the operator isn't retyping what the app already knows.
      // Capped at 20 chars to satisfy the modal's limit; the operator can edit it.
      setWeekOffInitialReason(
        week.conflicts?.[0] ? extractHolidayName(week.conflicts[0].name).slice(0, 20) : '',
      );
      setSelectedWeekIndex(index);
      setShowWeekOffModal(true);
    }
  };

  /**
   * Confirm handler for the blackout-reason modal: add a blackout on the selected
   * play week with the operator's reason as its label.
   */
  const handleAddBlackout = async (reason: string) => {
    setShowWeekOffModal(false);
    const index = selectedWeekIndex;
    setSelectedWeekIndex(null);
    setWeekOffInitialReason('');
    if (index === null) return;
    const week = schedule[index];
    if (!week?.dbId) return;
    await applyReflow({ kind: 'add', date: week.date, reason, skipType: 'blackout' });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center text-muted-foreground">Loading schedule...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !league) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-card rounded-xl shadow-sm p-6">
            <h3 className="text-destructive text-lg font-semibold mb-4">Error</h3>
            <p className="text-foreground mb-4">{error}</p>
            <Button onClick={() => navigate(`/league/${leagueId}`)} loadingText="none">
              Back to League
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-muted ${snapshot ? 'pb-24' : 'pb-8'}`}>
      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back To League"
        title="Manage Schedule"
        subtitle={`${season?.season_name} • ${league?.division || 'League'}`}
      />
      {/*
        Revert / Save pair appears in a fixed bottom bar only once the operator has
        made a change (snapshot captured). Save just clears the snapshot; Revert
        restores the starting schedule. Leaving without either keeps the changes
        (they apply as you go) but drops the ability to revert.
      */}
      {snapshot && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-card p-3 shadow-lg">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={handleRevert}
              disabled={processing}
              isLoading={processing}
              loadingText="Reverting..."
              className="w-full"
            >
              Revert Changes
            </Button>
            <Button onClick={handleDone} disabled={processing} loadingText="none" className="w-full">
              Save
            </Button>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Instructions Info Button */}
        <div className="my-4">
          <InfoButton title="Instructions" label="Instructions">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Click "Insert Week Off" to skip a week (holiday, break, etc.) — every change saves right away.</li>
              <li>Click "Remove Week Off" to turn a skipped week back into a play week.</li>
              <li>The rest of the season shifts automatically; the matchups stay with their weeks (only the dates move).</li>
              <li>Holiday/championship flags stay on their real calendar date — they don't follow a week as it shifts.</li>
              <li>Changed your mind? Hit "Revert Changes" to snap back to how the schedule started. "Save" keeps your changes.</li>
              <li>Past or already-played weeks can still be edited — you'll just get a heads-up first.</li>
            </ul>
          </InfoButton>
        </div>

        {/* Season Configuration Summary */}
        <div className="bg-info/10 border border-info/40 rounded-lg p-4 mb-6">
          <div className="grid lg:grid-cols-2 gap-3 lg:gap-32 text-sm">
            {/* Left Column: Start Date & Season Length */}
            <div className="space-y-3">
              <div>
                <span className="font-semibold text-info">Starting Date:</span>
                <span className="ml-2 text-foreground">
                  {season?.start_date ? new Date(season.start_date + 'T00:00:00').toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-info">Season Length:</span>
                <span className="ml-2 text-foreground">
                  {season?.season_length ? `${season.season_length} weeks` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Right Column: BCA & APA Championships */}
            <div className="space-y-3">
              <div>
                <span className="font-semibold text-info">BCA Championship:</span>
                <span className="ml-2 text-foreground">
                  {(() => {
                    const bcaWeeks = schedule.filter(w =>
                      w.type === 'week-off' &&
                      (w.weekName.toLowerCase().includes('bca') || w.weekName.toLowerCase().includes('championship'))
                    );
                    if (bcaWeeks.length === 0) return 'Not scheduled';
                    const start = bcaWeeks[0]?.date;
                    const end = bcaWeeks[bcaWeeks.length - 1]?.date;
                    return start && end
                      ? `${new Date(start + 'T00:00:00').toLocaleDateString()} - ${new Date(end + 'T00:00:00').toLocaleDateString()}`
                      : 'Not scheduled';
                  })()}
                </span>
              </div>
              <div>
                <span className="font-semibold text-info">APA Championship:</span>
                <span className="ml-2 text-foreground">
                  {(() => {
                    const apaWeeks = schedule.filter(w =>
                      w.type === 'week-off' && w.weekName.toLowerCase().includes('apa')
                    );
                    if (apaWeeks.length === 0) return 'Not scheduled';
                    const start = apaWeeks[0]?.date;
                    const end = apaWeeks[apaWeeks.length - 1]?.date;
                    return start && end
                      ? `${new Date(start + 'T00:00:00').toLocaleDateString()} - ${new Date(end + 'T00:00:00').toLocaleDateString()}`
                      : 'Not scheduled';
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-4 mb-6">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Schedule Table */}
        <div className="lg:bg-card lg:rounded-xl lg:shadow-sm lg:p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Season Schedule</h2>
          <ScheduleReviewTable
            schedule={schedule}
            onToggleWeekOff={handleToggleWeekOff}
            currentPlayWeek={getCurrentPlayWeek()}
            allowLockedToggle
          />
        </div>

        {/* Week-Off Reason Modal */}
        <Suspense fallback={null}>
          <WeekOffReasonModal
            isOpen={showWeekOffModal}
            initialReason={weekOffInitialReason}
            onCancel={() => {
              setShowWeekOffModal(false);
              setSelectedWeekIndex(null);
              setWeekOffInitialReason('');
            }}
            onConfirm={handleAddBlackout}
          />
        </Suspense>
        {ConfirmDialogComponent}
      </div>
    </div>
  );
};

export default SeasonScheduleManager;
