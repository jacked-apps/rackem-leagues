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
  // Two keys: the legacy underscore key (in case anything still uses it)
  // and the actual hyphen-cased key used by useResolvedLeaguePrefs. The
  // hook's key was diverging silently — preference upserts ran but the
  // resolver cache stayed stale, so UIs reading enabled_events / other
  // resolved fields didn't refresh until manual page reload. Fixed
  // during Branch B Phase 2.
  queryClient.invalidateQueries({ queryKey: ['resolved_league_preferences'] });
  queryClient.invalidateQueries({ queryKey: ['resolved-league-preferences'] });
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
