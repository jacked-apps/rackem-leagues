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
 * Update an existing preference. Only provided fields are changed.
 * Set a field to null to clear it (cascades to next level).
 */
export async function updatePreference(params: UpdatePreferenceParams): Promise<Preference> {
  const { preferenceId, ...fields } = params;

  const { data, error } = await supabase
    .from('preferences')
    .update(fields)
    .eq('id', preferenceId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update preference: ${error.message}`);
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

  if (error) throw new Error(`Failed to upsert preference: ${error.message}`);
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
