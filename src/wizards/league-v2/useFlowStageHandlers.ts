/**
 * @fileoverview Stage handlers for the "Create New League" flow
 *
 * Each handler runs when its stage completes (e.g., DB write).
 * Returns context updates that get merged into the flow context
 * for later stages.
 */

import { toast } from 'sonner';
import { buildLeagueTitle } from '@/utils/leagueUtils';
import { deriveDateFields } from './leagueWizardHelpers';
import { useCreateLeagueV2 } from './useCreateLeagueV2';
import { useCreateSeasonV2 } from '@/wizards/season-v2/useCreateSeasonV2';
import { useSaveScheduleV2 } from '@/wizards/schedule-v2/useSaveScheduleV2';
import { useSaveTeamsV2 } from '@/wizards/teams-v2/useSaveTeamsV2';
import type { StageHandlers } from '@/components/wizard/WizardFlowShell';
import type { LeagueWizardFormData } from './leagueWizardTypes';
import type { SeasonWizardFormData } from '@/wizards/season-v2/seasonWizardTypes';
import type { ScheduleWizardFormData } from '@/wizards/schedule-v2/scheduleWizardTypes';
import type { TeamsWizardFormData } from '@/wizards/teams-v2/teamsWizardTypes';
import type { FlowContext } from '@/components/wizard';

interface UseFlowStageHandlersArgs {
  orgId: string;
  context: FlowContext;
  onLeagueCreated: (leagueId: string) => void;
}

export function useFlowStageHandlers({
  orgId,
  context,
  onLeagueCreated,
}: UseFlowStageHandlersArgs): StageHandlers {
  const createLeague = useCreateLeagueV2({ organizationId: orgId });
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
    league: async (formData) => {
      const fd = formData as LeagueWizardFormData;
      const league = await createLeague.mutateAsync(fd);
      toast.success('League created');
      onLeagueCreated(league.id);

      const dateFields = fd['start-date'] ? deriveDateFields(fd['start-date']) : null;
      const leagueName = buildLeagueTitle({
        gameType: fd['game-type'] ?? null,
        dayOfWeek: dateFields?.dayOfWeek ?? null,
        division: fd['qualifier']?.trim() || null,
        season: dateFields?.season ?? null,
        year: dateFields?.year ?? null,
      });

      return {
        leagueId: league.id,
        leagueStartDate: fd['start-date'],
        leagueName,
        gameType: fd['game-type'],
        leagueFormat: fd['league-format'],
      };
    },
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
      // Empty array = user chose to keep existing schedule, skip save
      if (!schedule || schedule.length === 0) {
        toast.success('Keeping existing schedule');
        return {};
      }
      if (!context.seasonId) {
        throw new Error('Missing season ID — cannot save schedule');
      }
      await saveSchedule.mutateAsync({ seasonId: context.seasonId, schedule });
      toast.success('Schedule saved');
      return {};
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

      const result = await saveTeams.mutateAsync({
        leagueId: context.leagueId,
        seasonId: context.seasonId,
        leagueFormat: context.leagueFormat ?? '5_man',
        venueIds,
        captains,
      });

      toast.success(
        `Created ${result.teams.length} team${result.teams.length === 1 ? '' : 's'} at ${result.venueCount} venue${result.venueCount === 1 ? '' : 's'}`,
      );
      return {};
    },
  };
}
