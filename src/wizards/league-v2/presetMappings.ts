/**
 * @fileoverview Preset Mappings — maps format presets to their field values
 *
 * When a user picks a preset (Fargo/3v3/5v5), these mappings define all
 * the modular field values that get locked in automatically. Used by the
 * dual-write mutation to populate both the leagues table and the
 * preferences table.
 *
 * ADDING A NEW PRESET: Add an entry here, add its card in
 * leagueFormatOptions.ts, and the wizard handles the rest.
 */

import type { PreferenceFields } from '@/api/mutations/preferenceTypes';
import type { TeamFormat, HandicapVariant } from '@/types/league';

/** Values the dual-write needs for the leagues table (backward compat) */
export interface LeagueLegacyFields {
  teamFormat: TeamFormat;
  handicapVariant: HandicapVariant;
  teamHandicapVariant: HandicapVariant;
}

/** Combined mapping: legacy fields + modular preference fields */
export interface PresetMapping {
  legacy: LeagueLegacyFields;
  preferences: Partial<PreferenceFields>;
}

/**
 * Maps each preset key to its full set of field values.
 * Custom path doesn't use this — its values come from the wizard steps.
 */
/**
 * Map a StandingsSortStep selection to the 3-element sort-key priority
 * array stored in `preferences.standings_sort`. The wizard exposes three
 * preset orderings as cards; this collapses each to its corresponding
 * priority list. Unknown / undefined values default to the BCA Classic
 * ordering (match_wins → games_won → points_earned).
 */
export type SortKey = 'match_wins' | 'games_won' | 'points_earned';

export function mapStandingsSort(value: string | undefined): SortKey[] {
  switch (value) {
    case 'points_first':
      return ['points_earned', 'match_wins', 'games_won'];
    case 'games_won_first':
      return ['games_won', 'match_wins', 'points_earned'];
    case 'wins_first':
    default:
      return ['match_wins', 'games_won', 'points_earned'];
  }
}

/**
 * Map a TiebreakerStep selection to the (trigger, format) pair stored
 * in `preferences.tiebreaker_trigger` + `preferences.tiebreaker_format`.
 *
 * The wizard collapses these two DB axes into a single user choice
 * because the meaningful combinations are coupled: trigger=never always
 * pairs with format=accept_tie, and trigger=even_total_games_only
 * always pairs with one of the two short-race formats.
 *
 * Unknown / undefined defaults to (never, accept_tie) — the safest
 * choice when the user skipped the step (which only happens when the
 * configured lineup geometry can't tie anyway).
 */
export function mapTiebreaker(value: string | undefined): {
  tiebreaker_trigger: 'even_total_games_only' | 'never';
  tiebreaker_format: 'best_of_3_short_race' | 'single_short_race' | 'accept_tie';
} {
  switch (value) {
    case 'best_of_3':
      return {
        tiebreaker_trigger: 'even_total_games_only',
        tiebreaker_format: 'best_of_3_short_race',
      };
    case 'single_short_race':
      return {
        tiebreaker_trigger: 'even_total_games_only',
        tiebreaker_format: 'single_short_race',
      };
    case 'accept_tie':
    default:
      return {
        tiebreaker_trigger: 'never',
        tiebreaker_format: 'accept_tie',
      };
  }
}

/**
 * Resolve a league wizard form's modular preference fields. For preset
 * formats (fargo_5v5, standard_3v3, standard_5v5), values come from the
 * mapping table below. For the 'custom' path, values come directly from
 * the wizard's step answers.
 */
export function getLeaguePresetModularFields(formData: {
  'league-format'?: string;
  'lineup-size'?: number;
  'roster-size'?: number;
  'match-format'?: string;
  'handicap-system'?: string;
}): Partial<PreferenceFields> {
  const presetKey = formData['league-format'];
  if (presetKey && presetKey !== 'custom' && PRESET_MAPPINGS[presetKey]) {
    return PRESET_MAPPINGS[presetKey].preferences;
  }
  return {
    lineup_size: formData['lineup-size'],
    max_roster_size: formData['roster-size'],
    game_generation: formData['match-format'],
    handicap_type: formData['handicap-system'],
  };
}

// Phase 4 Unit 4.1: every preset gets explicit values for all 13 modular
// axes. Defaults align with how each preset has historically scored, so
// existing leagues created via these cards get characterization-equivalent
// behavior post-refactor. Custom path collects each axis individually.
export const PRESET_MAPPINGS: Record<string, PresetMapping> = {
  fargo_5v5: {
    legacy: {
      teamFormat: '5_man' as TeamFormat,
      handicapVariant: 'standard' as HandicapVariant,
      teamHandicapVariant: 'standard' as HandicapVariant,
    },
    preferences: {
      lineup_size: 5,
      max_roster_size: 8,
      game_generation: 'single_round_robin',
      handicap_type: 'fargo',
      points_system: 'differential',
      pairing_format: 'single_rack',
      scoring_method: 'points_10_7',
      win_condition: 'highest_after_all_games',
      mechanism: 'start_points',
      standings_sort: ['points_earned', 'match_wins', 'games_won'],
      // 5v5 single-RR = 25 games (odd) → no tiebreaker possible
      tiebreaker_trigger: 'never',
      tiebreaker_format: 'accept_tie',
      race_length: null,
    },
  },
  standard_3v3: {
    legacy: {
      teamFormat: '5_man' as TeamFormat,
      handicapVariant: 'standard' as HandicapVariant,
      teamHandicapVariant: 'standard' as HandicapVariant,
    },
    preferences: {
      lineup_size: 3,
      max_roster_size: 5,
      game_generation: 'double_round_robin',
      handicap_type: 'points',
      points_system: 'differential',
      pairing_format: 'single_rack',
      scoring_method: 'winner_takes_all',
      win_condition: 'first_to_games',
      mechanism: 'extra_games',
      standings_sort: ['match_wins', 'games_won', 'points_earned'],
      // 3v3 double-RR = 18 games (even) → ties possible at 9-9
      tiebreaker_trigger: 'even_total_games_only',
      tiebreaker_format: 'best_of_3_short_race',
      race_length: null,
    },
  },
  standard_5v5: {
    legacy: {
      teamFormat: '8_man' as TeamFormat,
      handicapVariant: 'standard' as HandicapVariant,
      teamHandicapVariant: 'standard' as HandicapVariant,
    },
    preferences: {
      lineup_size: 5,
      max_roster_size: 8,
      game_generation: 'single_round_robin',
      handicap_type: 'percentage',
      points_system: 'bca_tiered',
      pairing_format: 'single_rack',
      scoring_method: 'winner_takes_all',
      win_condition: 'first_to_games',
      mechanism: 'extra_games',
      standings_sort: ['match_wins', 'games_won', 'points_earned'],
      // 5v5 single-RR = 25 games (odd) → no tiebreaker possible
      tiebreaker_trigger: 'never',
      tiebreaker_format: 'accept_tie',
      race_length: null,
    },
  },
};
