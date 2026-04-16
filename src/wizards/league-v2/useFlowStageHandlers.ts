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
import type { StageHandlers } from '@/components/wizard/WizardFlowShell';
import type { LeagueWizardFormData } from './leagueWizardTypes';
import type { SeasonWizardFormData } from '@/wizards/season-v2/seasonWizardTypes';
import type { ScheduleWizardFormData } from '@/wizards/schedule-v2/scheduleWizardTypes';
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
      if (!schedule || schedule.length === 0) {
        throw new Error('No schedule to save');
      }
      if (!context.seasonId) {
        throw new Error('Missing season ID — cannot save schedule');
      }
      await saveSchedule.mutateAsync({ seasonId: context.seasonId, schedule });
      toast.success('Schedule saved');
      return {};
    },
  };
}
