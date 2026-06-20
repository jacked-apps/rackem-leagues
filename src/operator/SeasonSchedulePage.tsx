/**
 * @fileoverview Matchups Page (route `/league/:leagueId/season/:seasonId/matchups`)
 *
 * This is the **Matchups** page — who plays who each week. (The file keeps its
 * `SeasonSchedulePage` name for now; the user-facing title + URL are "Matchups".)
 * Displays the complete week-by-week matchups with venues, dates, and status.
 * Accessible to both operators and players.
 *
 * Operators can edit weeks to rearrange team matchups and change venues.
 * Edit mode allows one week at a time to be edited, with save/cancel/revert.
 *
 * (Date/blackout management lives separately on `SeasonScheduleManager` — the
 * "Schedule" page.)
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Calendar, MapPin, Trash2, Pencil, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseLocalDate } from '@/utils/formatters';
import { clearSchedule } from '@/utils/scheduleGenerator';
import { buildLmsSchedule } from '@/utils/lmsExport/buildLmsSchedule';
import { lmsScheduleToXlsx, XLSX_MIME } from '@/utils/lmsExport/lmsScheduleToXlsx';
import { downloadBytes } from '@/utils/download';
import {
  useIsOperator,
  useSeasonById,
  useSeasonSchedule,
  useTeamsBySeason,
  useLeagueVenuesWithDetails,
} from '@/api/hooks';
import type { MatchWithDetails } from '@/types';
import { logger } from '@/utils/logger';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { WeekEditorView } from '@/components/schedule/WeekEditorView';
import type { MatchEditState, TeamVenueMap } from '@/components/schedule/useWeekEditor';
import type { TeamOption } from '@/components/schedule/TeamSelect';
import type { VenueOption } from '@/components/schedule/VenueSelect';

/**
 * Calculate table numbers per venue within a week
 * Returns a map of match ID to table number
 */
function calculateTableNumbers(matches: MatchWithDetails[]): Map<string, number> {
  const tableNumbers = new Map<string, number>();
  const venueCounters = new Map<string, number>();

  // Sort matches by match_number to maintain consistent ordering
  const sortedMatches = [...matches].sort((a, b) => a.match_number - b.match_number);

  for (const match of sortedMatches) {
    if (match.scheduled_venue_id) {
      // Get current counter for this venue (or start at 0)
      const currentCount = venueCounters.get(match.scheduled_venue_id) || 0;
      const tableNumber = currentCount + 1;

      // Store the table number for this match
      tableNumbers.set(match.id, tableNumber);

      // Increment the counter for this venue
      venueCounters.set(match.scheduled_venue_id, tableNumber);
    }
  }

  return tableNumbers;
}

/**
 * Get styling classes and label based on week type
 */
function getWeekTypeStyle(weekType: string): { bgColor: string; badge: string; badgeColor: string } {
  switch (weekType) {
    case 'playoffs':
      return {
        bgColor: 'bg-highlight/10 rounded-t-xl -my-6 py-3',
        badge: 'PLAYOFFS',
        badgeColor: 'bg-highlight text-highlight-foreground',
      };
    case 'blackout':
      return {
        bgColor: 'bg-muted rounded-t-xl -my-6 py-3',
        badge: 'BLACKOUT',
        badgeColor: 'bg-foreground text-background',
      };
    case 'season_end_break':
      return {
        bgColor: 'bg-warning/10 rounded-t-xl -my-6 py-3',
        badge: 'BREAK',
        badgeColor: 'bg-warning text-warning-foreground',
      };
    default:
      return {
        bgColor: 'bg-muted rounded-t-xl -my-6 py-3',
        badge: '',
        badgeColor: '',
      };
  }
}

/**
 * SeasonSchedulePage Component
 *
 * Displays the full season schedule organized by week.
 * Shows all matchups with teams and venues.
 * Includes all week types: regular, playoffs, blackouts, and breaks.
 */
export const SeasonSchedulePage: React.FC = () => {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();
  const isOperator = useIsOperator();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // Fetch season data with TanStack Query
  const { data: season, isLoading: seasonLoading } = useSeasonById(seasonId);

  // Fetch schedule data with TanStack Query
  const { data: schedule = [], isLoading: scheduleLoading } = useSeasonSchedule(seasonId);

  // Fetch teams for week editor dropdowns
  const { data: teamsData = [] } = useTeamsBySeason(seasonId);

  // Fetch league venues for week editor dropdowns
  const { data: leagueVenuesData = [] } = useLeagueVenuesWithDetails(leagueId);

  const [clearing, setClearing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Track which week is being edited (null = none)
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);

  const loading = seasonLoading || scheduleLoading;
  const seasonName = season?.season_name || `Season ${season?.season_length || 0} Weeks`;
  const seasonStatus = season?.status || '';

  // Check if any matches have been played (in_progress or completed)
  // Used to determine if "Clear Schedule" should be available
  const hasPlayedMatches = useMemo(() => {
    return schedule.some(({ matches }) =>
      matches.some(m => m.status === 'in_progress' || m.status === 'completed')
    );
  }, [schedule]);

  // Check if season has a BYE team (any REGULAR week match has null home or away team)
  // This happens when there's an odd number of teams
  // Note: Playoff matches also have null team IDs (TBD), so we exclude those
  const hasByeTeam = useMemo(() => {
    return schedule.some(({ week, matches }) =>
      week.week_type === 'regular' &&
      matches.some(m => m.home_team_id === null || m.away_team_id === null)
    );
  }, [schedule]);

  // Whether there's anything to export to LMS: at least one regular-week match
  // with both teams present (the round-robin matchups LMS imports).
  const hasExportableSchedule = useMemo(() => {
    return schedule.some(({ week, matches }) =>
      week.week_type === 'regular' &&
      matches.some(m => m.home_team_id !== null && m.away_team_id !== null)
    );
  }, [schedule]);

  // Transform teams data for dropdown (sorted alphabetically by team name)
  const teamOptions: TeamOption[] = useMemo(() => {
    return teamsData
      .map(team => ({
        id: team.id,
        teamName: team.team_name,
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [teamsData]);

  // Transform venues data for dropdown
  const venueOptions: VenueOption[] = useMemo(() => {
    return leagueVenuesData.map(lv => ({
      id: lv.venue.id,
      name: lv.venue.name,
      city: lv.venue.city,
      state: lv.venue.state,
    }));
  }, [leagueVenuesData]);

  // Build map of team ID to their home venue ID (for auto-venue updates in editor)
  const teamHomeVenues: TeamVenueMap = useMemo(() => {
    const map: TeamVenueMap = {};
    for (const team of teamsData) {
      map[team.id] = team.home_venue_id || null;
    }
    return map;
  }, [teamsData]);

  /**
   * Check if editing is allowed for a week (has any editable matches)
   */
  const canEditWeek = (matches: MatchWithDetails[]): boolean => {
    return matches.some(m => m.status === 'scheduled');
  };

  /**
   * Convert matches to edit state format
   * venueOverride starts as false - venue is linked to home team by default
   */
  const convertMatchesToEditState = (matches: MatchWithDetails[]): MatchEditState[] => {
    return matches.map(match => ({
      matchId: match.id,
      homeTeamId: match.home_team_id,
      awayTeamId: match.away_team_id,
      venueId: match.scheduled_venue_id,
      venueOverride: false, // Default to linked to home team
      tableNumber: match.assigned_table_number ?? null,
      homeTeamName: match.home_team?.team_name || 'BYE',
      awayTeamName: match.away_team?.team_name || 'BYE',
      isEditable: match.status === 'scheduled',
      matchNumber: match.match_number,
    }));
  };

  /**
   * Handle clicking edit on a week
   */
  const handleEditWeek = async (weekId: string) => {
    // If already editing a different week, confirm discard
    if (editingWeekId && editingWeekId !== weekId) {
      const confirmed = await confirm({
        title: 'Discard Changes?',
        message: 'You have unsaved changes in another week. Discard them and edit this week instead?',
        confirmText: 'Discard & Edit',
        confirmVariant: 'destructive',
      });
      if (!confirmed) return;
    }
    setEditingWeekId(weekId);
  };

  /**
   * Handle accepting the schedule
   * Updates season status to 'active' and completes league setup
   */
  const handleAcceptSchedule = async () => {
    if (!seasonId || !leagueId) return;

    const confirmed = await confirm({
      title: 'Accept Schedule?',
      message: 'Accept this schedule and activate the season? You can still make changes later if needed.',
      confirmText: 'Accept & Activate',
      confirmVariant: 'default',
    });

    if (!confirmed) return;

    setAccepting(true);

    try {
      // Update season status to 'active'
      const { error: updateError } = await supabase
        .from('seasons')
        .update({ status: 'active' })
        .eq('id', seasonId);

      if (updateError) throw updateError;

      // Navigate to league dashboard
      navigate(`/league/${leagueId}`);
    } catch (err) {
      logger.error('Error activating season', { error: err instanceof Error ? err.message : String(err) });
      setError('Failed to activate season');
    } finally {
      setAccepting(false);
    }
  };

  /**
   * Handle clearing the schedule
   * Deletes all matches and navigates back to schedule setup
   */
  const handleClearSchedule = async () => {
    if (!seasonId) return;

    const confirmed = await confirm({
      title: 'Delete Schedule?',
      message: 'Are you sure you want to delete all matches and regenerate the schedule? This cannot be undone.',
      confirmText: 'Delete All',
      confirmVariant: 'destructive',
    });

    if (!confirmed) return;

    setClearing(true);
    const result = await clearSchedule(seasonId);

    if (result.success) {
      navigate(`/league/${leagueId}/season/${seasonId}/schedule-setup`);
    } else {
      setError(result.error || 'Failed to clear schedule');
      setClearing(false);
    }
  };

  /**
   * Export the schedule as an LMS-importable .xlsx — a two-sheet workbook
   * (Schedule grid of `away @ home` + Teams legend, teams numbered
   * alphabetically) matching CSI/FargoRate LMS's own export, so an operator can
   * import it there and LMS's schedule mirrors ours.
   */
  const handleExportLms = () => {
    const data = buildLmsSchedule(schedule);
    const bytes = lmsScheduleToXlsx(data);
    const slug = seasonName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
    downloadBytes(`lms_schedule_${slug || 'season'}.xlsx`, bytes, XLSX_MIME);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center text-muted-foreground">Loading schedule...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back"
        title="Matchups"
        subtitle={seasonName}
      >
        {/* Export for LMS — operator-only, available whenever a schedule exists
            (upcoming or active) so its CSI/FargoRate LMS schedule can mirror ours. */}
        {isOperator && hasExportableSchedule && (
          <div className="mt-2">
            <Button variant="outline" onClick={handleExportLms}>
              <Download className="h-4 w-4 mr-2" />
              Export for LMS
            </Button>
          </div>
        )}

        {/* Action buttons for operators during setup (season status = 'upcoming') */}
        {isOperator && seasonStatus === 'upcoming' && schedule.length > 0 && (
          <div className="mt-2 flex gap-3">
            {/* Clear Schedule - only available if no matches have been played */}
            {!hasPlayedMatches && (
              <Button
                variant="destructive"
                onClick={handleClearSchedule}
                disabled={clearing || accepting}
                isLoading={clearing}
                loadingText="Clearing..."
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Schedule
              </Button>
            )}
            <Button
              onClick={handleAcceptSchedule}
              disabled={accepting || clearing}
              isLoading={accepting}
              loadingText="Accepting..."
            >
              Accept Schedule & Complete Setup
            </Button>
          </div>
        )}
      </PageHeader>

      <div className="container mx-auto px-4 max-w-7xl py-8">
        {/* Schedule by Week */}
        <div className="space-y-6">
          {schedule.map(({ week, matches }) => {
            // If this week is being edited, show the WeekEditorView
            if (editingWeekId === week.id) {
              return (
                <WeekEditorView
                  key={week.id}
                  week={week}
                  initialMatches={convertMatchesToEditState(matches)}
                  teams={teamOptions}
                  venues={venueOptions}
                  teamHomeVenues={teamHomeVenues}
                  seasonId={seasonId!}
                  hasByeTeam={hasByeTeam}
                  onCancel={() => setEditingWeekId(null)}
                  onSaveSuccess={() => setEditingWeekId(null)}
                />
              );
            }

            // Otherwise show the display view
            const weekStyle = getWeekTypeStyle(week.week_type);
            const tableNumbers = calculateTableNumbers(matches);
            const showEditButton = isOperator && canEditWeek(matches) && week.week_type === 'regular';

            return (
              <Card key={week.id}>
                <CardHeader className={weekStyle.bgColor}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">
                        {week.week_type === 'blackout' ? week.week_name : week.week_name}
                      </CardTitle>
                      {weekStyle.badge && (
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${weekStyle.badgeColor}`}>
                          {week.week_type === 'blackout' ? 'BLACKOUT' : weekStyle.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Edit Week Button - only for operators and editable regular weeks */}
                      {showEditButton && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditWeek(week.id)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Week
                        </Button>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span className="hidden lg:block">
                        {parseLocalDate(week.scheduled_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        </span>
                        <span className="lg:hidden">
                        {parseLocalDate(week.scheduled_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  {matches.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      {week.week_type === 'playoffs'
                        ? 'Matchups TBD'
                        : week.week_type === 'regular'
                          ? 'No matches scheduled'
                          : 'No matches this week'}
                    </p>
                  ) : (
                  <div className="space-y-4">
                    {matches.map((match) => {
                      const tableNumber = tableNumbers.get(match.id);
                      return (
                      <div
                        key={match.id}
                        className="grid grid-cols-8 border border-border rounded-lg p-4 hover:bg-muted transition-colors"
                      >
                        {/* Teams */}
                        <div className="col-span-5 flex items-center justify-between">
                          <div className="flex w-full items-center gap-4">
                            <div className="text-right flex-1 flex flex-col items-center">
                              <span className="font-semibold text-foreground">
                                {match.home_team?.team_name || (week.week_type === 'playoffs' ? 'TBD' : 'BYE')}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">(Home)</span>
                            </div>
                            <div className="text-xl font-bold text-muted-foreground">vs</div>
                            <div className="text-left flex-1 flex flex-col items-center">
                              <span className="font-semibold text-foreground">
                                {match.away_team?.team_name || (week.week_type === 'playoffs' ? 'TBD' : 'BYE')}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">(Away)</span>
                            </div>
                          </div>
                        </div>

                        {/* Venue */}
                        <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground ml-6">
                          <MapPin className="h-4 w-4" />
                          {match.scheduled_venue ? (
                            <div>
                              <div className="font-medium">{match.scheduled_venue.name}</div>
                              <div className="text-xs">
                                {match.scheduled_venue.city}, {match.scheduled_venue.state}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground italic">Venue TBD</div>
                          )}
                        </div>

                        {/* Table Number - only show if venue exists */}
                        {match.scheduled_venue && tableNumber && (
                          <div className="ml-6 text-right">
                            <div className="text-xs text-muted-foreground">Table</div>
                            <div className="text-lg font-semibold text-foreground">
                              {tableNumber}
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>

        {schedule.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-lg font-medium text-foreground mb-2">No Schedule Yet</h3>
              <p className="text-muted-foreground mb-6">
                Generate your season schedule to see all matchups
              </p>
              <Button
                onClick={() => {
                  setIsNavigating(true);
                  navigate(`/league/${leagueId}/season/${seasonId}/schedule-setup`);
                }}
                disabled={isNavigating}
                isLoading={isNavigating}
                loadingText="Loading..."
              >
                Generate Schedule
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {ConfirmDialogComponent}
    </div>
  );
};

export default SeasonSchedulePage;
