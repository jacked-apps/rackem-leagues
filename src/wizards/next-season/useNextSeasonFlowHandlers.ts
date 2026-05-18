/**
 * @fileoverview Stage handlers for the "Start Next Season" flow.
 *
 * Mirrors `useFlowStageHandlers` from the first-time flow but drops
 * the `league` handler — the league already exists. The remaining
 * handlers (`season`, `schedule`, `teams`, `matchups`) delegate to
 * the SAME underlying mutation hooks the first-time flow uses, so
 * a bug fix or behavior change in those hooks lands in both places
 * automatically.
 */

import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';
import { useCreateSeasonV2 } from '@/wizards/season-v2/useCreateSeasonV2';
import { useSaveScheduleV2 } from '@/wizards/schedule-v2/useSaveScheduleV2';
import { useSaveTeamsV2 } from '@/wizards/teams-v2/useSaveTeamsV2';
import type { StageHandlers } from '@/components/wizard/WizardFlowShell';
import type { SeasonWizardFormData } from '@/wizards/season-v2/seasonWizardTypes';
import type { ScheduleWizardFormData } from '@/wizards/schedule-v2/scheduleWizardTypes';
import type { TeamsWizardFormData } from '@/wizards/teams-v2/teamsWizardTypes';
import type { FlowContext } from '@/components/wizard';

interface UseNextSeasonFlowHandlersArgs {
  context: FlowContext;
}

export function useNextSeasonFlowHandlers({
  context,
}: UseNextSeasonFlowHandlersArgs): StageHandlers {
  const createSeason = useCreateSeasonV2({
    leagueId: context.leagueId ?? '',
    league: {
      day_of_week: context.dayOfWeek ?? 'monday',
      game_type: context.gameType ?? 'eight_ball',
      division: context.division ?? null,
    },
  });
  const saveSchedule = useSaveScheduleV2();
  const saveTeams = useSaveTeamsV2();

  return {
    season: async (formData) => {
      const fd = formData as SeasonWizardFormData;
      const season = await createSeason.mutateAsync(fd);
      toast.success('Season created');

      const playoffValue = fd['playoff-format'] as { format?: string } | undefined;
      const playoffMapping = playoffValue?.format
        ? (await import('@/wizards/season-v2/playoffPresetMappings')).PLAYOFF_PRESET_MAPPINGS[playoffValue.format]
        : null;

      return {
        seasonId: season.id,
        seasonName: season.season_name,
        seasonLength: fd['season-length'] ?? 16,
        playoffWeeks: playoffMapping?.playoffWeeks ?? 1,
      };
    },
    schedule: async (formData) => {
      const fd = formData as ScheduleWizardFormData;
      const schedule = fd['schedule-review'];
      if (!schedule || schedule.length === 0) {
        toast.success('Keeping existing schedule');
        return { scheduleComplete: true };
      }
      if (!context.seasonId) {
        throw new Error('Missing season ID — cannot save schedule');
      }
      await saveSchedule.mutateAsync({ seasonId: context.seasonId, schedule });
      toast.success('Schedule saved');
      return { scheduleComplete: true };
    },
    teams: async (formData) => {
      const fd = formData as TeamsWizardFormData;
      const venueIds = fd['venues'] ?? [];
      const captains = fd['captains'] ?? [];

      if (!context.leagueId) {
        throw new Error('Missing league ID — cannot save teams');
      }
      if (!context.seasonId) {
        throw new Error('Missing season ID — cannot save teams');
      }

      const { data: prefs } = await supabase
        .from('resolved_league_preferences')
        .select('max_roster_size')
        .eq('league_id', context.leagueId)
        .single();
      const maxRosterSize = prefs?.max_roster_size ?? 5;

      const result = await saveTeams.mutateAsync({
        leagueId: context.leagueId,
        seasonId: context.seasonId,
        maxRosterSize,
        venueIds,
        captains,
      });

      toast.success(
        `Created ${result.teams.length} team${result.teams.length === 1 ? '' : 's'} at ${result.venueCount} venue${result.venueCount === 1 ? '' : 's'}`,
      );
      return {
        teamCount: result.teams.length,
        venueCount: result.venueCount,
      };
    },
    matchups: async () => {
      if (!context.seasonId) {
        throw new Error('Missing season ID — cannot activate season');
      }
      const { error } = await supabase
        .from('seasons')
        .update({ status: 'active' })
        .eq('id', context.seasonId);
      if (error) throw new Error(`Failed to activate season: ${error.message}`);
      toast.success('New season is live!');
      return {};
    },
  };
}
