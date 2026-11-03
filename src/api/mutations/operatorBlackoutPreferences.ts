/**
 * @fileoverview Operator Blackout Preferences Mutations
 *
 * Functions for creating, updating, and deleting operator blackout preferences.
 * These preferences control automatic blackout weeks and ignored conflicts
 * for holidays, championships, and custom dates.
 *
 * Related tables:
 * - operator_blackout_preferences: Stores operator preferences
 * - championship_date_options: Referenced by championship preferences
 */

import { supabase } from '@/supabaseClient';
import type { OperatorBlackoutPreference } from '@/types/operator';
import type { TablesUpdate } from '@/types/database.types';

/**
 * Parameters for creating an operator blackout preference
 */
export interface CreateOperatorBlackoutPreferenceParams {
  organization_id: string;
  preference_type: 'holiday' | 'championship' | 'custom';
  preference_action: 'blackout' | 'ignore';
  holiday_name?: string;
  championship_id?: string;
  custom_name?: string;
  custom_start_date?: string;
  custom_end_date?: string;
  auto_apply?: boolean;
}

/**
 * Parameters for updating an operator blackout preference
 */
export interface UpdateOperatorBlackoutPreferenceParams {
  preferenceId: string;
  preference_action?: 'blackout' | 'ignore';
  holiday_name?: string;
  championship_id?: string;
  custom_name?: string;
  custom_start_date?: string;
  custom_end_date?: string;
  auto_apply?: boolean;
}

/**
 * Parameters for deleting an operator blackout preference
 */
export interface DeleteOperatorBlackoutPreferenceParams {
  preferenceId: string;
}

/**
 * Create a new operator blackout preference
 *
 * Validates that required fields are present based on preference_type.
 * - holiday: requires holiday_name
 * - championship: requires championship_id
 * - custom: requires custom_name, custom_start_date, custom_end_date
 *
 * @param params - Preference creation parameters
 * @returns Created preference
 * @throws Error if validation fails or database operation fails
 *
 * @example
 * // Create championship blackout
 * const pref = await createOperatorBlackoutPreference({
 *   organization_id: 'org-123',
 *   preference_type: 'championship',
 *   preference_action: 'blackout',
 *   championship_id: 'champ-456'
 * });
 */
export async function createOperatorBlackoutPreference(
  params: CreateOperatorBlackoutPreferenceParams
): Promise<OperatorBlackoutPreference> {
  // Validation
  if (!params.organization_id) {
    throw new Error('Organization ID is required');
  }

  if (!params.preference_type) {
    throw new Error('Preference type is required');
  }

  if (!params.preference_action) {
    throw new Error('Preference action is required');
  }

  // Type-specific validation
  if (params.preference_type === 'holiday' && !params.holiday_name) {
    throw new Error('Holiday name is required for holiday preferences');
  }

  if (params.preference_type === 'championship' && !params.championship_id) {
    throw new Error('Championship ID is required for championship preferences');
  }

  if (params.preference_type === 'custom') {
    if (!params.custom_name || !params.custom_start_date || !params.custom_end_date) {
      throw new Error('Custom preferences require name, start_date, and end_date');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.custom_start_date) || !dateRegex.test(params.custom_end_date)) {
      throw new Error('Custom dates must be in YYYY-MM-DD format');
    }

    // Validate end >= start
    if (new Date(params.custom_end_date) < new Date(params.custom_start_date)) {
      throw new Error('Custom end date must be on or after start date');
    }
  }

  const { data, error } = await supabase
    .from('operator_blackout_preferences')
    .insert([
      {
        organization_id: params.organization_id,
        preference_type: params.preference_type,
        preference_action: params.preference_action,
        holiday_name: params.holiday_name ?? null,
        championship_id: params.championship_id ?? null,
        custom_name: params.custom_name ?? null,
        custom_start_date: params.custom_start_date ?? null,
        custom_end_date: params.custom_end_date ?? null,
        auto_apply: params.auto_apply ?? false,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to create operator blackout preference: ${error.message} (${error.code})`
    );
  }

  return data;
}

/**
 * Update an existing operator blackout preference
 *
 * Only provided fields will be updated.
 *
 * @param params - Preference update parameters
 * @returns Updated preference
 * @throws Error if validation fails or database operation fails
 *
 * @example
 * const updated = await updateOperatorBlackoutPreference({
 *   preferenceId: 'pref-123',
 *   preference_action: 'ignore',
 *   auto_apply: true
 * });
 */
export async function updateOperatorBlackoutPreference(
  params: UpdateOperatorBlackoutPreferenceParams
): Promise<OperatorBlackoutPreference> {
  if (!params.preferenceId) {
    throw new Error('Preference ID is required');
  }

  // Build update object with only provided fields
  const updates: TablesUpdate<'operator_blackout_preferences'> = {};

  if (params.preference_action !== undefined) {
    updates.preference_action = params.preference_action;
  }

  if (params.holiday_name !== undefined) {
    updates.holiday_name = params.holiday_name;
  }

  if (params.championship_id !== undefined) {
    updates.championship_id = params.championship_id;
  }

  if (params.custom_name !== undefined) {
    updates.custom_name = params.custom_name;
  }

  if (params.custom_start_date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.custom_start_date)) {
      throw new Error('Custom start date must be in YYYY-MM-DD format');
    }
    updates.custom_start_date = params.custom_start_date;
  }

  if (params.custom_end_date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.custom_end_date)) {
      throw new Error('Custom end date must be in YYYY-MM-DD format');
    }
    updates.custom_end_date = params.custom_end_date;
  }

  if (params.auto_apply !== undefined) {
    updates.auto_apply = params.auto_apply;
  }

  const { data, error } = await supabase
    .from('operator_blackout_preferences')
    .update(updates)
    .eq('id', params.preferenceId)
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to update operator blackout preference: ${error.message} (${error.code})`
    );
  }

  return data;
}

/**
 * Delete an operator blackout preference
 *
 * @param params - Preference deletion parameters
 * @throws Error if database operation fails
 *
 * @example
 * await deleteOperatorBlackoutPreference({ preferenceId: 'pref-123' });
 */
export async function deleteOperatorBlackoutPreference(
  params: DeleteOperatorBlackoutPreferenceParams
): Promise<void> {
  if (!params.preferenceId) {
    throw new Error('Preference ID is required');
  }

  const { error } = await supabase
    .from('operator_blackout_preferences')
    .delete()
    .eq('id', params.preferenceId);

  if (error) {
    throw new Error(
      `Failed to delete operator blackout preference: ${error.message} (${error.code})`
    );
  }
}
