/**
 * @fileoverview Resolved League Preferences Hook
 *
 * Single source of truth for reading league preferences. Queries the
 * resolved_league_preferences view (league → org → system default cascade).
 *
 * Phase 7 Unit 7.2 of the modular-league-system v2 plan: the lazy-
 * migration path that derived modular fields from the old `team_format`
 * column was removed. Wizard 2.0 (Phase 4) is now the only league-creation
 * path and writes the modular fields directly. Pre-Wizard-2.0 dev data is
 * disposable per the project's data principle — `db reset` rebuilds.
 *
 * Every component that needs lineup_size, max_roster_size, or handicap_type
 * should use this hook instead of querying the view directly.
 */

import { useQuery } from '@tanstack/react-query';
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
   * Win-condition axis from the v2 modular plan: 'games' = whoever wins
   * more games (BCA-style, tie band possible) decides the match;
   * 'points' = whoever earned more points (Fargo-style, never a true tie)
   * decides the match. Optional because the resolved view selectors don't
   * always include it; consumers fall back to 'games' when absent.
   */
  win_condition?: 'games' | 'points';
  /**
   * Threshold-mechanism axis from the v2 modular plan: how the
   * handicap is applied. 'extra_games' (BCA / Fargo-games-won),
   * 'start_points' (Fargo-points), 'race_length_adjustment' (BCAPL
   * Skill Level), 'none' (no handicap). Optional because the resolved
   * view selectors don't always include it; consumers fall back to
   * 'extra_games' when absent.
   */
  mechanism?: 'extra_games' | 'start_points' | 'race_length_adjustment' | 'none';
  /**
   * Active points calculator name (registry key — e.g.
   * `'linear_above_threshold'`, `'accumulate_with_milestone_jumps'`,
   * `'accumulated_per_game'`, or the `'none'` sentinel). Optional because
   * legacy resolved-preferences views may not select it; consumers fall
   * back to null when absent.
   */
  points_calculator?: string | null;
  /**
   * Per-league dial overrides from `leagues.system_overrides` (not part of the
   * preferences cascade — stored directly on the league row). Always an object;
   * `{}` if no overrides are set. Merged over SystemModule defaults at read time.
   */
  system_overrides: SystemOverrides;
}

/**
 * Reads the resolved-preferences view + the league's per-league overrides
 * in parallel. Returns the merged shape — view fields with `system_overrides`
 * appended.
 */
async function fetchResolvedLeaguePrefs(leagueId: string): Promise<ResolvedLeaguePrefs> {
  const [viewRes, leagueRes] = await Promise.all([
    supabase
      .from('resolved_league_preferences')
      .select('handicap_type, lineup_size, max_roster_size, game_generation, points_system, threshold_chart_id, win_condition, mechanism, points_calculator')
      .eq('league_id', leagueId)
      .single(),
    supabase
      .from('leagues')
      .select('system_overrides')
      .eq('id', leagueId)
      .single(),
  ]);

  const { data: resolved, error: viewError } = viewRes;
  const systemOverrides = (leagueRes.data?.system_overrides as SystemOverrides | undefined) ?? {};

  if (viewError) {
    logger.error('Failed to read resolved_league_preferences', { leagueId, error: viewError.message });
    // Safe defaults so the UI doesn't break — every modular axis has a
    // non-null fallback the UI can render. New leagues never hit this
    // branch (Wizard 2.0 always populates a preferences row).
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

  return { ...resolved, system_overrides: systemOverrides } as ResolvedLeaguePrefs;
}

/**
 * Hook to get resolved league preferences.
 *
 * Caches per leagueId. Wizard 2.0 (Phase 4) is the only league-creation
 * path; pre-Wizard-2.0 lazy-migration was removed in Phase 7 Unit 7.2.
 *
 * @example
 * const { data: prefs } = useResolvedLeaguePrefs(leagueId);
 * const lineupSize = prefs?.lineup_size ?? 3;
 * const handicapType = prefs?.handicap_type ?? 'points';
 */
export function useResolvedLeaguePrefs(leagueId: string | null | undefined) {
  return useQuery({
    queryKey: ['resolved-league-preferences', leagueId],
    queryFn: () => fetchResolvedLeaguePrefs(leagueId!),
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000, // 5 minutes — preferences rarely change mid-session
  });
}
