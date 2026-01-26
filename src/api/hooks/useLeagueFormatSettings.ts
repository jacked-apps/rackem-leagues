/**
 * @fileoverview League Format Settings Hooks (TanStack Query)
 *
 * React hooks for fetching and managing per-league format configuration.
 * Uses TanStack Query for state management and caching.
 *
 * These hooks provide access to league-specific settings including:
 * - Lineup size and roster configuration
 * - Handicap type and threshold chart references
 * - Game generation method and total games
 * - Points system configuration
 *
 * @example
 * // Fetch settings for a league
 * const { data: settings } = useLeagueFormatSettings(leagueId);
 *
 * // Get or create settings (ensures settings exist)
 * const { data: settings } = useLeagueFormatSettingsOrCreate(leagueId);
 *
 * // Update settings
 * const { mutate: updateSettings } = useUpdateLeagueFormatSettings();
 * updateSettings({ leagueId, updates: { lineup_size: 5 } });
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLeagueFormatSettings,
  getLeagueFormatSettingsWithChart,
  getOrCreateLeagueFormatSettings,
  createLeagueFormatSettings,
  updateLeagueFormatSettings,
  upsertLeagueFormatSettings,
  deleteLeagueFormatSettings,
  type LeagueFormatSettings,
  type LeagueFormatSettingsWithChart,
  type CreateLeagueFormatSettingsInput,
  type UpdateLeagueFormatSettingsInput,
  type HandicapType,
  type GameGeneration,
  type PointsSystem,
} from '../queries/leagueFormatSettings';
import { STALE_TIME } from '../client';

// =============================================================================
// QUERY KEYS
// =============================================================================

/** Query key factory for league format settings */
export const leagueFormatSettingsKeys = {
  all: ['leagueFormatSettings'] as const,
  detail: (leagueId: string) => [...leagueFormatSettingsKeys.all, 'detail', leagueId] as const,
  withChart: (leagueId: string) =>
    [...leagueFormatSettingsKeys.all, 'withChart', leagueId] as const,
};

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Fetch league format settings
 *
 * Returns null if settings don't exist yet. Use useLeagueFormatSettingsOrCreate
 * if you want to ensure settings exist.
 *
 * @param leagueId - League ID
 * @returns TanStack Query result with settings or null
 *
 * @example
 * const { data: settings, isLoading } = useLeagueFormatSettings(leagueId);
 * if (settings) {
 *   console.log(`League uses ${settings.lineup_size}v${settings.lineup_size} format`);
 * }
 */
export function useLeagueFormatSettings(leagueId: string | null | undefined) {
  return useQuery({
    queryKey: leagueFormatSettingsKeys.detail(leagueId!),
    queryFn: () => getLeagueFormatSettings(leagueId!),
    enabled: !!leagueId,
    staleTime: STALE_TIME.MEMBER, // 15 minutes - settings rarely change
  });
}

/**
 * Fetch league format settings with chart name included
 *
 * Useful for displaying the current chart selection to the user.
 *
 * @param leagueId - League ID
 * @returns TanStack Query result with settings and chart name
 */
export function useLeagueFormatSettingsWithChart(leagueId: string | null | undefined) {
  return useQuery({
    queryKey: leagueFormatSettingsKeys.withChart(leagueId!),
    queryFn: () => getLeagueFormatSettingsWithChart(leagueId!),
    enabled: !!leagueId,
    staleTime: STALE_TIME.MEMBER,
  });
}

/**
 * Fetch league format settings, creating defaults if they don't exist
 *
 * This hook calls the database function that returns existing settings or
 * creates default settings based on the league's team_format column.
 *
 * Use this when you NEED settings to exist (e.g., Match Data Page).
 *
 * @param leagueId - League ID
 * @returns TanStack Query result with settings (never null on success)
 *
 * @example
 * // Settings will be created if they don't exist
 * const { data: settings } = useLeagueFormatSettingsOrCreate(leagueId);
 * // settings is guaranteed to exist if query succeeded
 */
export function useLeagueFormatSettingsOrCreate(leagueId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: leagueFormatSettingsKeys.detail(leagueId!),
    queryFn: async () => {
      const settings = await getOrCreateLeagueFormatSettings(leagueId!);
      // Also update the withChart cache if we have it
      queryClient.setQueryData(leagueFormatSettingsKeys.withChart(leagueId!), (old: LeagueFormatSettingsWithChart | undefined) =>
        old
          ? { ...settings, threshold_chart_name: old.threshold_chart_name }
          : undefined
      );
      return settings;
    },
    enabled: !!leagueId,
    staleTime: STALE_TIME.MEMBER,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Create league format settings
 *
 * Use this to explicitly create settings with specific values.
 * For most cases, prefer useLeagueFormatSettingsOrCreate or useUpsertLeagueFormatSettings.
 *
 * @returns Mutation function and state
 *
 * @example
 * const { mutate: createSettings, isPending } = useCreateLeagueFormatSettings();
 * createSettings({
 *   league_id: leagueId,
 *   lineup_size: 5,
 *   handicap_type: 'percentage',
 * });
 */
export function useCreateLeagueFormatSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeagueFormatSettingsInput) => createLeagueFormatSettings(input),
    onSuccess: (data) => {
      // Update both query variants
      queryClient.setQueryData(leagueFormatSettingsKeys.detail(data.league_id), data);
      queryClient.invalidateQueries({
        queryKey: leagueFormatSettingsKeys.withChart(data.league_id),
      });
    },
  });
}

/**
 * Update league format settings
 *
 * @returns Mutation function and state
 *
 * @example
 * const { mutate: updateSettings, isPending } = useUpdateLeagueFormatSettings();
 * updateSettings({
 *   leagueId,
 *   updates: {
 *     team_threshold_chart_id: newChartId,
 *     total_games: 20,
 *   },
 * });
 */
export function useUpdateLeagueFormatSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      leagueId,
      updates,
    }: {
      leagueId: string;
      updates: UpdateLeagueFormatSettingsInput;
    }) => updateLeagueFormatSettings(leagueId, updates),
    onSuccess: (data) => {
      // Update both query variants
      queryClient.setQueryData(leagueFormatSettingsKeys.detail(data.league_id), data);
      // Invalidate withChart since chart name may have changed
      queryClient.invalidateQueries({
        queryKey: leagueFormatSettingsKeys.withChart(data.league_id),
      });
    },
  });
}

/**
 * Upsert league format settings (create or update)
 *
 * Creates settings if they don't exist, or updates if they do.
 * Useful when you don't know if settings already exist.
 *
 * @returns Mutation function and state
 *
 * @example
 * const { mutate: upsertSettings } = useUpsertLeagueFormatSettings();
 * upsertSettings({
 *   league_id: leagueId,
 *   lineup_size: 3,
 *   handicap_type: 'points',
 *   total_games: 18,
 * });
 */
export function useUpsertLeagueFormatSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeagueFormatSettingsInput) => upsertLeagueFormatSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(leagueFormatSettingsKeys.detail(data.league_id), data);
      queryClient.invalidateQueries({
        queryKey: leagueFormatSettingsKeys.withChart(data.league_id),
      });
    },
  });
}

/**
 * Delete league format settings
 *
 * Note: Settings are typically cascade deleted when a league is deleted.
 * This is provided for manual cleanup if needed.
 *
 * @returns Mutation function and state
 */
export function useDeleteLeagueFormatSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leagueId: string) => deleteLeagueFormatSettings(leagueId),
    onSuccess: (_data, leagueId) => {
      queryClient.removeQueries({
        queryKey: leagueFormatSettingsKeys.detail(leagueId),
      });
      queryClient.removeQueries({
        queryKey: leagueFormatSettingsKeys.withChart(leagueId),
      });
    },
  });
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type {
  LeagueFormatSettings,
  LeagueFormatSettingsWithChart,
  CreateLeagueFormatSettingsInput,
  UpdateLeagueFormatSettingsInput,
  HandicapType,
  GameGeneration,
  PointsSystem,
};

// Re-export utility functions
export { calculateEstimatedGames, getChartTypeForHandicapType } from '../queries/leagueFormatSettings';
