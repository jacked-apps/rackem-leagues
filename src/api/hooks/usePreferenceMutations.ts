/**
 * @fileoverview Preference Mutation Hooks (TanStack Query)
 *
 * Generic hooks for preference CRUD. Works with any combination of
 * preference fields (old and new). Automatically invalidates preference
 * caches on success.
 *
 * @see api/mutations/preferences.ts - Pure mutation functions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createPreference,
  updatePreference,
  upsertPreference,
  deletePreference,
} from '../mutations/preferences';

/** Shared cache invalidation for all preference mutations */
function invalidatePreferenceCache(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['preferences'] });
  queryClient.invalidateQueries({ queryKey: ['resolved_league_preferences'] });
}

/** Create a new preference record */
export function useCreatePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPreference,
    onSuccess: () => invalidatePreferenceCache(queryClient),
  });
}

/** Update an existing preference record */
export function useUpdatePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePreference,
    onSuccess: () => invalidatePreferenceCache(queryClient),
  });
}

/** Upsert — create if missing, update if exists */
export function useUpsertPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertPreference,
    onSuccess: () => invalidatePreferenceCache(queryClient),
  });
}

/** Delete a preference record */
export function useDeletePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePreference,
    onSuccess: () => invalidatePreferenceCache(queryClient),
  });
}
