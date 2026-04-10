/**
 * @fileoverview Preference type definitions
 *
 * Shared types for the preferences table — both original columns and
 * the new modular columns from Wizard 2.0. Used by mutations, hooks,
 * and any component that reads/writes preferences.
 */

/**
 * All settable preference fields — old and new. Every field is optional
 * and nullable (NULL = inherit from next level in the cascade).
 */
export interface PreferenceFields {
  // Original columns
  handicap_variant?: string | null;
  team_handicap_variant?: string | null;
  game_history_limit?: number | null;
  team_format?: string | null;
  golden_break_counts_as_win?: boolean | null;
  allow_unauthorized_players?: boolean | null;
  profanity_filter_enabled?: boolean | null;

  // New modular columns (Wizard 2.0)
  lineup_size?: number | null;
  max_roster_size?: number | null;
  game_generation?: string | null;
  handicap_type?: string | null;
  points_system?: string | null;
  uses_fargo?: boolean | null;
  threshold_chart_id?: string | null;
}

/** Full preference record as returned from the database */
export interface Preference extends PreferenceFields {
  id: string;
  entity_type: 'organization' | 'league';
  entity_id: string;
  created_at?: string;
  updated_at?: string;
}

/** Params for creating a preference — entity info + any fields */
export type CreatePreferenceParams = {
  entity_type: 'organization' | 'league';
  entity_id: string;
} & Partial<PreferenceFields>;

/** Params for updating — preference ID + any fields to change */
export type UpdatePreferenceParams = {
  preferenceId: string;
} & Partial<PreferenceFields>;

/** Params for upsert — entity info + any fields */
export type UpsertPreferenceParams = CreatePreferenceParams;
