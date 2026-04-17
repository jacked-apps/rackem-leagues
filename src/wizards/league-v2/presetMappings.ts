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
    },
  },
};
