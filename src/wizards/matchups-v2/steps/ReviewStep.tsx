/**
 * @fileoverview ReviewStep — generates (if needed) and displays the schedule
 *
 * On mount, if no matches exist for the season, calls generateSchedule with
 * the positions from form data. Renders a week-by-week view with per-week
 * Edit buttons that open Jack's WeekEditorView inline (swap teams, change
 * venues, adjust tables). All saves happen incrementally via WeekEditorView's
 * own mutation, so this step has no aggregate save action — Next simply
 * completes the wizard.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseLocalDate } from '@/utils/formatters';
import { deriveWeekLabels } from '@/utils/scheduleDisplayUtils';
import { generateSchedule, clearSchedule } from '@/utils/scheduleGenerator';
import { useSeasonSchedule, useTeamsBySeason, useLeagueVenuesWithDetails } from '@/api/hooks';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { WeekEditorView } from '@/components/schedule/WeekEditorView';
import type { MatchEditState, TeamVenueMap } from '@/components/schedule/useWeekEditor';
import type { TeamOption } from '@/components/schedule/TeamSelect';
import type { VenueOption } from '@/components/schedule/VenueSelect';
import type { MatchWithDetails } from '@/types';
import type { WizardStepProps } from '@/components/wizard';
import type { MatchupsWizardFormData } from '../matchupsWizardTypes';

function toEditState(matches: MatchWithDetails[]): MatchEditState[] {
  return matches.map((m) => ({
    matchId: m.id,
    homeTeamId: m.home_team_id,
    awayTeamId: m.away_team_id,
    venueId: m.scheduled_venue_id,
    venueOverride: false,
    tableNumber: m.assigned_table_number ?? null,
    homeTeamName: m.home_team?.team_name ?? 'BYE',
    awayTeamName: m.away_team?.team_name ?? 'BYE',
    isEditable: m.status === 'scheduled',
    matchNumber: m.match_number,
  }));
}

export function ReviewStep({ formData, onBack }: WizardStepProps<unknown, MatchupsWizardFormData>) {
  const ctx = (formData as Record<string, unknown>)._flowContext as
    | { seasonId?: string; leagueId?: string }
    | undefined;
  const seasonId = ctx?.seasonId ?? '';
  const leagueId = ctx?.leagueId ?? '';
  // Positions can come from either:
  //   - formData.positions (manual path — operator went through PositionsStep)
  //   - formData['matchups-mode'].positions (fast-track — gate randomized them
  //     and skipped PositionsStep entirely)
  const positions =
    formData.positions ?? formData['matchups-mode']?.positions ?? [];

  const queryClient = useQueryClient();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const { data: schedule = [], isLoading: scheduleLoading } = useSeasonSchedule(seasonId);
  const { data: teams = [] } = useTeamsBySeason(seasonId);
  const { data: leagueVenues = [] } = useLeagueVenuesWithDetails(leagueId);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await generateSchedule({ seasonId, teams: positions, skipExistingCheck: true });
      if (!result.success) throw new Error(result.error ?? 'Schedule generation failed');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  // Generate matches on mount if none exist for this season
  useEffect(() => {
    if (!seasonId || positions.length === 0 || scheduleLoading) return;
    const hasMatches = schedule.some(({ matches }) => matches.length > 0);
    if (hasMatches || generateMutation.isPending || generateMutation.isSuccess || genError) return;
    generateMutation.mutate(undefined, {
      onError: (err) => setGenError(err instanceof Error ? err.message : 'Generation failed'),
    });
  }, [seasonId, positions.length, schedule, scheduleLoading, generateMutation, genError]);

  const teamOptions: TeamOption[] = useMemo(
    () => teams.map((t) => ({ id: t.id, teamName: t.team_name })).sort((a, b) => a.teamName.localeCompare(b.teamName)),
    [teams],
  );
  const venueOptions: VenueOption[] = useMemo(
    () => leagueVenues.map((lv) => ({ id: lv.venue.id, name: lv.venue.name, city: lv.venue.city, state: lv.venue.state })),
    [leagueVenues],
  );
  const teamHomeVenues: TeamVenueMap = useMemo(() => {
    const map: TeamVenueMap = {};
    for (const t of teams) map[t.id] = t.home_venue_id ?? null;
    return map;
  }, [teams]);
  const hasByeTeam = useMemo(
    () =>
      schedule.some(
        ({ week, matches }) =>
          week.week_type === 'regular' && matches.some((m) => m.home_team_id === null || m.away_team_id === null),
      ),
    [schedule],
  );

  // Week numbers are DERIVED from position by date (across all weeks), never the
  // stored week_name which can drift/collide (e.g. a duplicate "Week 14").
  // Declared before the early returns below so the hook order stays stable.
  const weekLabels = useMemo(
    () => deriveWeekLabels(schedule.map(({ week }) => week)),
    [schedule],
  );

  if (!seasonId || !leagueId) return <p className="text-destructive">Missing league/season ID from flow context.</p>;
  if (generateMutation.isPending) return <p className="text-sm text-muted-foreground">Generating schedule...</p>;
  if (genError) return <p className="text-destructive">Error generating schedule: {genError}</p>;
  if (scheduleLoading) return <p className="text-sm text-muted-foreground">Loading schedule...</p>;

  const regularWeeks = schedule.filter(({ week }) => week.week_type === 'regular');

  const handleResetMatchups = async () => {
    const ok = await confirm({
      title: 'Reset matchups?',
      message:
        'This deletes all generated matches and sends you back to the team positions page so you can reshuffle or reassign and regenerate.\n\nAny per-week edits you\'ve already made will be lost.\n\nNote: you\'ll also be able to edit individual weeks later from the season schedule page — you don\'t have to get everything perfect right now.',
      confirmText: 'Yes, Reset Matchups',
      cancelText: 'Keep Current',
      confirmVariant: 'destructive',
    });
    if (!ok) return;
    setClearing(true);
    const result = await clearSchedule(seasonId);
    setClearing(false);
    if (!result.success) {
      toast.error(result.error ?? 'Failed to reset matchups');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    queryClient.invalidateQueries({ queryKey: ['matches'] });
    toast.success('Matchups reset — adjust positions and regenerate');
    onBack();
  };

  return (
    <div className="space-y-4">
      {regularWeeks.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
          <div className="text-sm text-foreground">
            <strong>Not happy with the matchups?</strong>{' '}
            Reset to wipe and redo. You can also edit individual weeks below.
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleResetMatchups}
            isLoading={clearing}
            loadingText="Resetting..."
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset Matchups
          </Button>
        </div>
      )}

      {regularWeeks.map(({ week, matches }) => {
        if (editingWeekId === week.id) {
          return (
            <WeekEditorView
              key={week.id}
              week={week}
              weekLabel={weekLabels.get(week.id)}
              initialMatches={toEditState(matches)}
              teams={teamOptions}
              venues={venueOptions}
              teamHomeVenues={teamHomeVenues}
              seasonId={seasonId}
              hasByeTeam={hasByeTeam}
              onCancel={() => setEditingWeekId(null)}
              onSaveSuccess={() => setEditingWeekId(null)}
            />
          );
        }
        return (
          <Card key={week.id}>
            <CardHeader className="bg-muted rounded-t-xl -my-6 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{weekLabels.get(week.id) ?? week.week_name}</CardTitle>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setEditingWeekId(week.id)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit Week
                  </Button>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{parseLocalDate(week.scheduled_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {matches.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{m.home_team?.team_name ?? 'BYE'}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="font-medium">{m.away_team?.team_name ?? 'BYE'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.scheduled_venue?.name ?? 'Venue TBD'}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
      {regularWeeks.length === 0 && (
        <p className="text-sm text-muted-foreground">No regular-season weeks found.</p>
      )}

      {regularWeeks.length > 0 && (
        <div className="rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm text-foreground">
          <strong>Ready to activate?</strong>{' '}
          Click <strong>Finish</strong> below to accept this schedule and move the
          season from "upcoming" to "active" — captains can now build out their
          teams and then score their matches.
          <br />
          Don&apos;t stress about getting every matchup perfect right now — you
          can edit individual weeks anytime from the season schedule page:
          swap teams, change venues, or adjust tables whenever you need to.
        </div>
      )}

      {ConfirmDialogComponent}
    </div>
  );
}
