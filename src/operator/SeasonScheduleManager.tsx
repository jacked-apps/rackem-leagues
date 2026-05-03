/**
 * @fileoverview Season Schedule Manager
 *
 * Allows operators to manage blackout weeks (holidays/breaks) for existing seasons.
 * Operators can add or remove blackout weeks for future dates only.
 * Past weeks (already played) cannot be modified.
 */
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { ScheduleReviewTable } from '@/components/season/ScheduleReviewTable';
import { InfoButton } from '@/components/InfoButton';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const WeekOffReasonModal = lazy(() => import('@/components/modals/WeekOffReasonModal').then(m => ({ default: m.WeekOffReasonModal })));
import type { WeekEntry, ChampionshipEvent } from '@/types/season';
import type { League } from '@/types/league';
import { formatLocalDate, parseLocalDate } from '@/utils/formatters';
import { fetchHolidaysForSeason } from '@/utils/holidayUtils';
import { detectScheduleConflicts } from '@/utils/conflictDetectionUtils';

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
  const [originalSchedule, setOriginalSchedule] = useState<WeekEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWeekOffModal, setShowWeekOffModal] = useState(false);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);

  /**
   * Load league, season, and existing schedule from database
   */
  useEffect(() => {
    const fetchData = async () => {
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

        // Extract championship events from blackout weeks
        const bcaWeeks = transformedSchedule.filter(w =>
          w.type === 'week-off' &&
          (w.weekName.toLowerCase().includes('bca') || w.weekName.toLowerCase().includes('championship'))
        );
        const apaWeeks = transformedSchedule.filter(w =>
          w.type === 'week-off' && w.weekName.toLowerCase().includes('apa')
        );

        const bcaChampionship: ChampionshipEvent | undefined =
          bcaWeeks.length > 0
            ? {
                start: bcaWeeks[0].date,
                end: bcaWeeks[bcaWeeks.length - 1].date,
                ignored: false,
              }
            : undefined;

        const apaChampionship: ChampionshipEvent | undefined =
          apaWeeks.length > 0
            ? {
                start: apaWeeks[0].date,
                end: apaWeeks[apaWeeks.length - 1].date,
                ignored: false,
              }
            : undefined;

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
        setOriginalSchedule(JSON.parse(JSON.stringify(scheduleWithConflicts))); // Deep clone for comparison
      } catch (err) {
        logger.error('Error loading schedule', { error: err instanceof Error ? err.message : String(err) });
        setError('Failed to load season schedule');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId, seasonId]);

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
   * Check if a week can be edited (must be in the future)
   */
  const canEditWeek = (weekIndex: number): boolean => {
    const week = schedule[weekIndex];
    const today = formatLocalDate(new Date());

    // Cannot edit if week is in the past or already completed
    return week.date >= today && !week.weekCompleted;
  };

  /**
   * Handle toggle week-off button click
   */
  const handleToggleWeekOff = (index: number) => {
    if (!canEditWeek(index)) {
      toast.error('Cannot edit past weeks or completed weeks');
      return;
    }

    const week = schedule[index];

    // If it's already a week-off, remove it (convert back to regular)
    if (week.type === 'week-off') {
      removeBlackoutWeek(index);
    } else {
      // It's a regular week - show modal to add blackout reason
      setSelectedWeekIndex(index);
      setShowWeekOffModal(true);
    }
  };

  /**
   * Add a blackout week with a reason
   */
  const addBlackoutWeek = (reason: string) => {
    if (selectedWeekIndex === null) return;

    const updatedSchedule = [...schedule];
    const week = updatedSchedule[selectedWeekIndex];

    // Convert regular week to blackout
    week.type = 'week-off';
    week.weekName = reason;
    week.isModified = true; // Mark as modified for saving

    setSchedule(updatedSchedule);
    setShowWeekOffModal(false);
    setSelectedWeekIndex(null);
  };

  /**
   * Remove a blackout week (convert back to regular)
   */
  const removeBlackoutWeek = (index: number) => {
    const updatedSchedule = [...schedule];
    const week = updatedSchedule[index];

    // Find what the week number should be by counting previous regular weeks
    let weekNumber = 1;
    for (let i = 0; i < index; i++) {
      if (updatedSchedule[i].type === 'regular') {
        weekNumber++;
      }
    }

    // Convert blackout back to regular
    week.type = 'regular';
    week.weekName = `Week ${weekNumber}`;
    week.weekNumber = weekNumber;
    week.isModified = true; // Mark as modified for saving

    // Renumber all subsequent regular weeks
    let nextWeekNumber = weekNumber + 1;
    for (let i = index + 1; i < updatedSchedule.length; i++) {
      if (updatedSchedule[i].type === 'regular') {
        updatedSchedule[i].weekNumber = nextWeekNumber;
        updatedSchedule[i].weekName = `Week ${nextWeekNumber}`;
        updatedSchedule[i].isModified = true;
        nextWeekNumber++;
      }
    }

    setSchedule(updatedSchedule);
  };

  /**
   * Check if there are unsaved changes
   */
  const hasChanges = (): boolean => {
    return JSON.stringify(schedule) !== JSON.stringify(originalSchedule);
  };

  /**
   * Save changes to database
   */
  const handleSaveChanges = async () => {
    if (!seasonId) return;

    setSaving(true);
    setError(null);

    try {
      // Find all modified weeks
      const modifiedWeeks = schedule.filter(week => week.isModified);

      // Update each modified week
      for (const week of modifiedWeeks) {
        if (!week.dbId) continue; // Skip if no DB ID (shouldn't happen)

        // Map UI type back to database week_type
        let dbWeekType: 'regular' | 'blackout' | 'playoffs' | 'season_end_break' = 'regular';
        if (week.type === 'playoffs') {
          dbWeekType = 'playoffs';
        } else if (week.type === 'week-off') {
          // Determine if it's blackout or season_end_break based on name
          dbWeekType = week.weekName === 'Season End Break' ? 'season_end_break' : 'blackout';
        }

        const { error: updateError } = await supabase
          .from('season_weeks')
          .update({
            week_name: week.weekName,
            week_type: dbWeekType,
          })
          .eq('id', week.dbId);

        if (updateError) throw updateError;
      }

      // Update original schedule to match current (reset "modified" state)
      setOriginalSchedule(JSON.parse(JSON.stringify(schedule)));

      // Navigate back to league detail
      navigate(`/league/${leagueId}`);
    } catch (err) {
      logger.error('Error saving schedule changes', { error: err instanceof Error ? err.message : String(err) });
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cancel and go back without saving
   */
  const handleCancel = async () => {
    if (hasChanges()) {
      const confirmed = await confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        confirmText: 'Leave',
        confirmVariant: 'destructive',
      });
      if (!confirmed) return;
    }
    navigate(`/league/${leagueId}`);
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
            <h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>
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
    <div className="min-h-screen bg-muted pb-24">
      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back To League"
        title="Manage Schedule"
        subtitle={`${season?.season_name} • ${league?.division || 'League'}`}
      />
      {/*
        Save / Cancel pair lives in a fixed bottom bar (R6a) so it stays in
        the thumb zone and does not scroll out of view on long schedule edits.
        Wrapper above adds pb-24 to keep the last row of content above the bar.
      */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-card p-3 shadow-lg">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveChanges}
            disabled={!hasChanges() || saving}
            isLoading={saving}
            loadingText="Saving..."
            className="flex items-center gap-2 w-full"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Instructions Info Button */}
        <div className="my-4">
          <InfoButton title="Instructions" label="Instructions">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Click "Insert Week-Off" to add a blackout week (holiday, break, etc.)</li>
              <li>Click "Remove Week-Off" to convert a blackout week back to a regular week</li>
              <li>You can only edit future weeks (past weeks are locked)</li>
              <li>Week numbers will automatically adjust when you add/remove blackout weeks</li>
            </ul>
          </InfoButton>
        </div>

        {/* Season Configuration Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="grid lg:grid-cols-2 gap-3 lg:gap-32 text-sm">
            {/* Left Column: Start Date & Season Length */}
            <div className="space-y-3">
              <div>
                <span className="font-semibold text-blue-900">Starting Date:</span>
                <span className="ml-2 text-blue-800">
                  {season?.start_date ? new Date(season.start_date + 'T00:00:00').toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-blue-900">Season Length:</span>
                <span className="ml-2 text-blue-800">
                  {season?.season_length ? `${season.season_length} weeks` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Right Column: BCA & APA Championships */}
            <div className="space-y-3">
              <div>
                <span className="font-semibold text-blue-900">BCA Championship:</span>
                <span className="ml-2 text-blue-800">
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
                <span className="font-semibold text-blue-900">APA Championship:</span>
                <span className="ml-2 text-blue-800">
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Schedule Table */}
        <div className="lg:bg-card lg:rounded-xl lg:shadow-sm lg:p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Season Schedule</h2>
          <ScheduleReviewTable
            schedule={schedule}
            onToggleWeekOff={handleToggleWeekOff}
            currentPlayWeek={getCurrentPlayWeek()}
          />
        </div>

        {/* Week-Off Reason Modal */}
        <Suspense fallback={null}>
          <WeekOffReasonModal
            isOpen={showWeekOffModal}
            onCancel={() => {
              setShowWeekOffModal(false);
              setSelectedWeekIndex(null);
            }}
            onConfirm={addBlackoutWeek}
          />
        </Suspense>
        {ConfirmDialogComponent}
      </div>
    </div>
  );
};

export default SeasonScheduleManager;
