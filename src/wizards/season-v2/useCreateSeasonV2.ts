/**
 * @fileoverview useCreateSeasonV2 — saves season + playoff config from wizard
 *
 * Creates:
 *   1. Season row (league_id, name, dates, length, status)
 *   2. Playoff configuration (maps wizard preset to playoff_configurations table)
 *
 * Does NOT generate season_weeks — that's the Schedule Manager's job (Stage 3).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { savePlayoffConfiguration } from '@/api/mutations/playoffConfigurations';
import { parseLocalDate, formatLocalDate } from '@/utils/formatters';
import { generateSeasonName } from '@/types/season';
import { formatDayOfWeek, formatGameType, type DayOfWeek, type GameType } from '@/types/league';
import type { SeasonWizardFormData } from './seasonWizardTypes';
import { PLAYOFF_PRESET_MAPPINGS } from './playoffPresetMappings';

interface UseCreateSeasonV2Args {
  leagueId: string;
  /** League details needed for season name generation */
  league: {
    day_of_week: string;
    game_type: string;
    division?: string | null;
  };
}

export function useCreateSeasonV2({ leagueId, league }: UseCreateSeasonV2Args) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: SeasonWizardFormData) => {
      const intro = formData['intro'] as { leagueStartDate?: string } | undefined;
      const startDateStr = formData['season-start-date'] ?? intro?.leagueStartDate;
      if (!startDateStr) throw new Error('Start date is required');

      const seasonLength = formData['season-length'] ?? 16;
      const startDate = parseLocalDate(startDateStr);

      // Calculate end date (season length in weeks from start)
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (seasonLength * 7));

      // Generate season name from league details
      const seasonName = generateSeasonName(
        startDate,
        formatDayOfWeek(league.day_of_week as DayOfWeek),
        formatGameType(league.game_type as GameType),
        league.division ?? undefined,
      );

      // 1. Create season row
      const { data: season, error } = await supabase
        .from('seasons')
        .insert([{
          league_id: leagueId,
          season_name: seasonName,
          start_date: formatLocalDate(startDate),
          end_date: formatLocalDate(endDate),
          season_length: seasonLength,
          status: 'upcoming',
        }])
        .select()
        .single();

      if (error) throw new Error(`Failed to create season: ${error.message}`);

      // 2. Save playoff configuration from the wizard preset
      const playoffValue = formData['playoff-format'] as
        { format?: string; wildcard?: boolean } | undefined;

      if (playoffValue?.format) {
        const preset = PLAYOFF_PRESET_MAPPINGS[playoffValue.format];
        // Only save a playoff config when there ARE playoffs. The DB enforces
        // playoff_weeks >= 1, so "none" (playoffWeeks = 0) would fail the
        // CHECK constraint. A season without a config simply has no playoffs.
        if (preset && preset.playoffWeeks > 0) {
          await savePlayoffConfiguration({
            entityType: 'league',
            entityId: leagueId,
            name: `${seasonName} Playoffs`,
            qualificationType: preset.qualificationType,
            fixedTeamCount: preset.fixedTeamCount,
            qualifyingPercentage: preset.qualifyingPercentage,
            playoffWeeks: preset.playoffWeeks,
            weekMatchupStyles: preset.weekMatchupStyles,
            wildcardSpots: playoffValue.wildcard ? 1 : 0,
            paymentMethod: 'automatic',
          });
        }
      }

      return season;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
      queryClient.invalidateQueries({ queryKey: ['playoff-configurations'] });
      // Force the flow-stage-detection query to refetch so the wizard's
      // handler context picks up the new seasonId. Without this, the next
      // stage's handler runs with stale context and throws "missing season ID".
      queryClient.invalidateQueries({ queryKey: ['flow-stage-detection'] });
    },
  });
}
