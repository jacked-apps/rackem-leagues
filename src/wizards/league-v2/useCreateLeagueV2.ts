/**
 * @fileoverview useCreateLeagueV2 — dual-write mutation for Wizard 2.0
 *
 * Called when the user clicks Finish on the league creation wizard.
 * Performs two writes:
 *   1. Creates a league row (existing createLeague — backward compat)
 *   2. Upserts a preferences row with the modular fields
 *
 * For presets (Fargo/3v3/5v5), field values come from PRESET_MAPPINGS.
 * For custom, field values come directly from the wizard form data.
 *
 * @see presetMappings.ts - Preset → field value mappings
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLeague } from '@/api/mutations/leagues';
import { upsertPreference } from '@/api/mutations/preferences';
import { formatLocalDate } from '@/utils/formatters';
import { PRESET_MAPPINGS, mapStandingsSort, mapTiebreaker } from './presetMappings';
import { deriveDateFields } from './leagueWizardHelpers';
import type { LeagueWizardFormData } from './leagueWizardTypes';
import type { DayOfWeek, GameType } from '@/types/league';

interface UseCreateLeagueV2Args {
  organizationId: string;
}

export function useCreateLeagueV2({ organizationId }: UseCreateLeagueV2Args) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: LeagueWizardFormData) => {
      const format = formData['league-format'] ?? 'standard_3v3';
      const isCustom = format === 'custom';
      const preset = !isCustom ? PRESET_MAPPINGS[format] : null;

      // Derive day of week from start date
      const dateFields = formData['start-date']
        ? deriveDateFields(formData['start-date'])
        : null;

      const dayOfWeek = (dateFields?.dayOfWeek?.toLowerCase() ?? 'monday') as DayOfWeek;

      // 1. Create the league row (backward compat fields)
      const league = await createLeague({
        operatorId: organizationId,
        gameType: (formData['game-type'] ?? 'eight_ball') as GameType,
        dayOfWeek,
        teamFormat: preset?.legacy.teamFormat ?? '5_man',
        handicapVariant: preset?.legacy.handicapVariant ?? 'standard',
        teamHandicapVariant: preset?.legacy.teamHandicapVariant ?? 'standard',
        leagueStartDate: formData['start-date'] ?? formatLocalDate(new Date()),
        division: formData['qualifier']?.trim() || null,
      });

      // 2. Upsert preferences row with modular fields.
      //
      // For presets, values come from PRESET_MAPPINGS (all 13 axes baked in).
      // For custom, each axis is sourced from its wizard step. Two axes
      // require a small key→DB-shape transform:
      //   - standings-sort: a single preset key maps to a 3-element priority array
      //   - tiebreaker:    a single key maps to (trigger, format) pair
      // (See StandingsSortStep / TiebreakerStep for the user-facing options.)
      const prefFields = isCustom
        ? {
            lineup_size: formData['lineup-size'] ?? 3,
            max_roster_size: formData['roster-size'] ?? 5,
            game_generation: formData['match-format'] ?? 'double_round_robin',
            handicap_type: formData['handicap-system'] ?? 'points',
            pairing_format: formData['pairing-format'] ?? 'single_rack',
            scoring_method: formData['scoring-method'] ?? 'winner_takes_all',
            win_condition: formData['win-condition'] ?? 'first_to_games',
            mechanism: formData['mechanism'] ?? 'extra_games',
            standings_sort: mapStandingsSort(formData['standings-sort']),
            ...mapTiebreaker(formData['tiebreaker']),
            // race_length defaults to NULL (single_rack); only meaningful
            // when pairing_format='race_to_n' — captured in a follow-up
            // unit, default 7 (race-to-7) is the BCAPL convention.
            race_length:
              (formData['pairing-format'] ?? 'single_rack') === 'race_to_n'
                ? formData['race-length'] ?? 7
                : null,
          }
        : preset?.preferences ?? {};

      await upsertPreference({
        entity_type: 'league',
        entity_id: league.id,
        ...prefFields,
      });

      return league;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
    },
  });
}
