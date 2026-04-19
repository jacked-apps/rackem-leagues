/**
 * @fileoverview Resolved League Preferences Hook
 *
 * Single source of truth for reading league preferences. Queries the
 * resolved_league_preferences view (league → org → system default cascade).
 *
 * If the modular fields (lineup_size, max_roster_size, handicap_type) are
 * missing for a league (legacy league created before Wizard 2.0), this hook
 * performs a lazy migration: derives the values from the old team_format
 * column and writes them to the preferences table so they exist next time.
 *
 * Every component that needs lineup_size, max_roster_size, or handicap_type
 * should use this hook instead of querying the view directly.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';
import type { SystemOverrides } from '@/types/systemOverrides';

/** The resolved preference fields we care about */
export interface ResolvedLeaguePrefs {
  handicap_type: string;
  lineup_size: number;
  max_roster_size: number;
  game_generation: string;
  points_system: string;
  threshold_chart_id: string | null;
  /**
   * Per-league dial overrides from `leagues.system_overrides` (not part of the
   * preferences cascade — stored directly on the league row). Always an object;
   * `{}` if no overrides are set. Merged over SystemModule defaults at read time.
   */
  system_overrides: SystemOverrides;
}

/** Maps old team_format to the new modular fields */
function deriveFromTeamFormat(teamFormat: string): Partial<ResolvedLeaguePrefs> {
  if (teamFormat === '8_man') {
    return {
      lineup_size: 5,
      max_roster_size: 8,
      game_generation: 'single_round_robin',
      handicap_type: 'percentage',
      points_system: 'bca_tiered',
    };
  }
  // Default: 5_man / 3v3
  return {
    lineup_size: 3,
    max_roster_size: 5,
    game_generation: 'double_round_robin',
    handicap_type: 'points',
    points_system: 'differential',
  };
}

/**
 * Ensures modular preferences exist for a league. If they're missing
 * (legacy league), derives them from team_format and writes to the DB.
 */
async function ensureLeaguePreferences(leagueId: string): Promise<ResolvedLeaguePrefs> {
  // Read from the resolved view (handles cascade) AND the leagues row in parallel.
  // system_overrides lives directly on the leagues table, not in the preferences
  // cascade, so we fetch it separately.
  const [viewRes, leagueRes] = await Promise.all([
    supabase
      .from('resolved_league_preferences')
      .select('handicap_type, lineup_size, max_roster_size, game_generation, points_system, threshold_chart_id')
      .eq('league_id', leagueId)
      .single(),
    supabase
      .from('leagues')
      .select('team_format, system_overrides')
      .eq('id', leagueId)
      .single(),
  ]);

  const { data: resolved, error: viewError } = viewRes;
  const systemOverrides = (leagueRes.data?.system_overrides as SystemOverrides | undefined) ?? {};

  if (viewError) {
    logger.error('Failed to read resolved_league_preferences', { leagueId, error: viewError.message });
    // Return safe defaults so the UI doesn't break
    return {
      handicap_type: 'points',
      lineup_size: 3,
      max_roster_size: 8,
      game_generation: 'double_round_robin',
      points_system: 'differential',
      threshold_chart_id: null,
      system_overrides: systemOverrides,
    };
  }

  // If the modular fields are already populated, return as-is (plus overrides)
  if (resolved.handicap_type && resolved.lineup_size && resolved.max_roster_size) {
    return { ...resolved, system_overrides: systemOverrides } as ResolvedLeaguePrefs;
  }

  // Legacy league — derive from team_format and write to preferences
  const derived = deriveFromTeamFormat(leagueRes.data?.team_format ?? '5_man');

  // Upsert the league-level preference so next time it's there
  const { error: upsertError } = await supabase
    .from('preferences')
    .upsert(
      {
        entity_type: 'league',
        entity_id: leagueId,
        ...derived,
      },
      { onConflict: 'entity_type,entity_id' },
    );

  if (upsertError) {
    logger.error('Failed to backfill league preferences', { leagueId, error: upsertError.message });
  }

  return { ...resolved, ...derived, system_overrides: systemOverrides } as ResolvedLeaguePrefs;
}

/**
 * Hook to get resolved league preferences with lazy migration.
 *
 * Caches per leagueId. If modular fields are missing (legacy league),
 * auto-writes them on first access so they exist going forward.
 *
 * @example
 * const { data: prefs } = useResolvedLeaguePrefs(leagueId);
 * const lineupSize = prefs?.lineup_size ?? 3;
 * const handicapType = prefs?.handicap_type ?? 'points';
 */
export function useResolvedLeaguePrefs(leagueId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['resolved-league-preferences', leagueId],
    queryFn: async () => {
      const result = await ensureLeaguePreferences(leagueId!);
      // Invalidate after a backfill write so the view reflects the new data
      queryClient.invalidateQueries({ queryKey: ['resolved-league-preferences', leagueId] });
      return result;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000, // 5 minutes — preferences rarely change mid-session
  });
}
