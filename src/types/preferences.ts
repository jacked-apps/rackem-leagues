/**
 * @fileoverview Preferences Type Definitions
 *
 * Single flexible table for both organization-level defaults and league-specific overrides.
 * Cascading fallback pattern: league → organization → system default
 */

import type { HandicapVariant } from './league';

/**
 * Entity type for preferences
 */
export type PreferenceEntityType = 'organization' | 'league';

/**
 * Preferences database record
 * Stores both organization defaults and league overrides in same table
 */
export interface Preferences {
  id: string;
  entity_type: PreferenceEntityType;
  entity_id: string; // organization_id for organization, league_id for league

  // Handicap Settings (NULL = use next level default)
  handicap_variant: HandicapVariant | null;
  team_handicap_variant: HandicapVariant | null;
  game_history_limit: number | null;

  // Match Rules (NULL = use next level default)
  golden_break_counts_as_win: boolean | null;

  // Player Authorization (NULL = use next level default, system default: true)
  allow_unauthorized_players: boolean | null;

  // Content Moderation (NULL = use next level default, system default: false)
  profanity_filter_enabled: boolean | null;

  // Modular Configuration (Wizard 2.0 — NULL = use next level default)
  lineup_size: number | null;
  max_roster_size: number | null;
  game_generation: string | null;
  handicap_type: string | null;
  points_system: string | null;
  threshold_chart_id: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Insert data for creating preferences
 * entity_type and entity_id required, all settings optional (will use defaults)
 */
export type PreferencesInsertData = {
  entity_type: PreferenceEntityType;
  entity_id: string;
  handicap_variant?: HandicapVariant | null;
  team_handicap_variant?: HandicapVariant | null;
  game_history_limit?: number | null;
  golden_break_counts_as_win?: boolean | null;
  allow_unauthorized_players?: boolean | null;
  profanity_filter_enabled?: boolean | null;
  lineup_size?: number | null;
  max_roster_size?: number | null;
  game_generation?: string | null;
  handicap_type?: string | null;
  points_system?: string | null;
  threshold_chart_id?: string | null;
};

/**
 * Update data for preferences
 * Can update any setting, all optional
 */
export type PreferencesUpdateData = Partial<Omit<Preferences,
  | 'id'
  | 'entity_type'
  | 'entity_id'
  | 'created_at'
  | 'updated_at'
>>;

/**
 * Organization preferences (convenience type)
 * Same as Preferences but entity_type is always 'organization'
 */
export type OrganizationPreferences = Preferences & {
  entity_type: 'organization';
  entity_id: string; // organization_id
};

/**
 * League preferences (convenience type)
 * Same as Preferences but entity_type is always 'league'
 */
export type LeaguePreferences = Preferences & {
  entity_type: 'league';
  entity_id: string; // league_id
};

/**
 * Resolved settings for a league with full fallback chain applied
 * This represents the final computed settings after cascading through:
 * 1. League-specific overrides
 * 2. Organization defaults
 * 3. System defaults (hardcoded)
 */
export interface ResolvedLeaguePreferences {
  league_id: string;
  organization_id: string;

  // All fields are non-nullable - fallback chain guarantees a value
  handicap_variant: HandicapVariant;
  team_handicap_variant: HandicapVariant;
  game_history_limit: number;
  golden_break_counts_as_win: boolean;
  allow_unauthorized_players: boolean;
  profanity_filter_enabled: boolean;

  // Modular fields (Wizard 2.0)
  lineup_size: number;
  max_roster_size: number;
  game_generation: string;
  handicap_type: string;
  points_system: string;
  threshold_chart_id: string | null;
}

/**
 * System default values (hardcoded fallbacks)
 * Used when no organization or league preference is set
 */
export const SYSTEM_DEFAULTS = {
  handicap_variant: 'standard' as HandicapVariant,
  team_handicap_variant: 'standard' as HandicapVariant,
  game_history_limit: 200,
  golden_break_counts_as_win: true,
  allow_unauthorized_players: true,
  profanity_filter_enabled: false,

  // Modular defaults (Wizard 2.0)
  lineup_size: 3,
  max_roster_size: 8,
  game_generation: 'double_round_robin',
  handicap_type: 'points',
  points_system: 'differential',
  threshold_chart_id: null,
} as const;
