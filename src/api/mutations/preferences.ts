/**
 * @fileoverview Preferences Mutation Functions (Generic)
 *
 * Generic CRUD for the preferences table. Accepts any combination of
 * preference fields. No hardcoded validation — DB constraints handle it.
 *
 * @see api/mutations/preferenceTypes.ts - Type definitions
 * @see api/hooks/usePreferenceMutations.ts - TanStack Query hooks
 */

import { supabase } from '@/supabaseClient';
import { isLeagueSeasonActive } from './leagues';
import type {
  Preference,
  CreatePreferenceParams,
  UpdatePreferenceParams,
  UpsertPreferenceParams,
} from './preferenceTypes';

// Re-export types for convenience
export type { Preference, PreferenceFields, CreatePreferenceParams, UpdatePreferenceParams, UpsertPreferenceParams } from './preferenceTypes';

/**
 * Create a new preference record. Pass any combination of fields.
 */
export async function createPreference(params: CreatePreferenceParams): Promise<Preference> {
  const { entity_type, entity_id, ...fields } = params;

  const { data, error } = await supabase
    .from('preferences')
    .insert([{ entity_type, entity_id, ...fields }])
    .select()
    .single();

  if (error) throw new Error(`Failed to create preference: ${error.message}`);
  return data;
}

/**
 * Tier 1 immutability — surface the DB trigger's exception as a clean error.
 *
 * The trigger `lock_tier1_league_preferences` in
 * supabase/migrations/20260418000002_lock_tier1_preferences.sql raises an
 * exception with the prefix "Cannot change handicap_type" or
 * "Cannot change lineup_size" when a league row tries to update those fields.
 * We catch it here and throw a simpler message for the UI to surface.
 */
function rewriteTier1Error(message: string): string {
  if (message.includes('Cannot change handicap_type')) {
    return 'Handicap type is locked at league creation. Create a new league to use a different scoring system.';
  }
  if (message.includes('Cannot change lineup_size')) {
    return 'Lineup size is locked at league creation. Create a new league to change it.';
  }
  return message;
}

/**
 * Tier 2 season-active lock — block edits to `threshold_chart_id` on league rows
 * while the season is active. (Tier 2 per docs/plans/.../plan.md.)
 *
 * Returns a user-facing error message string if the update should be blocked,
 * or null if the update is allowed.
 */
async function checkTier2LockForPreference(
  preferenceId: string,
  fields: Partial<{ threshold_chart_id: string | null }>,
): Promise<string | null> {
  // Only tier 2 fields currently on preferences: threshold_chart_id.
  // If the update doesn't touch a tier 2 field, no check needed.
  if (!('threshold_chart_id' in fields)) return null;

  const { data: pref, error } = await supabase
    .from('preferences')
    .select('entity_type, entity_id')
    .eq('id', preferenceId)
    .single();

  if (error || !pref) return null; // Can't determine — let the actual update surface the error
  if (pref.entity_type !== 'league') return null; // Organization rows are templates, not locked

  const active = await isLeagueSeasonActive(pref.entity_id);
  if (active) {
    return 'Threshold chart is locked while the season is active. Wait until the season ends to change it.';
  }
  return null;
}

/**
 * Update an existing preference. Only provided fields are changed.
 * Set a field to null to clear it (cascades to next level).
 */
export async function updatePreference(params: UpdatePreferenceParams): Promise<Preference> {
  const { preferenceId, ...fields } = params;

  const tier2Err = await checkTier2LockForPreference(preferenceId, fields);
  if (tier2Err) throw new Error(tier2Err);

  const { data, error } = await supabase
    .from('preferences')
    .update(fields)
    .eq('id', preferenceId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update preference: ${rewriteTier1Error(error.message)}`);
  return data;
}

/**
 * Upsert — create if missing, update if exists.
 * Matches on the unique (entity_type, entity_id) constraint.
 */
export async function upsertPreference(params: UpsertPreferenceParams): Promise<Preference> {
  const { entity_type, entity_id, ...fields } = params;

  const { data, error } = await supabase
    .from('preferences')
    .upsert(
      { entity_type, entity_id, ...fields },
      { onConflict: 'entity_type,entity_id' },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert preference: ${rewriteTier1Error(error.message)}`);
  return data;
}

/**
 * Delete a preference record. Entity falls back to next-level defaults.
 */
export async function deletePreference(params: { preferenceId: string }): Promise<void> {
  const { error } = await supabase
    .from('preferences')
    .delete()
    .eq('id', params.preferenceId);

  if (error) throw new Error(`Failed to delete preference: ${error.message}`);
}
