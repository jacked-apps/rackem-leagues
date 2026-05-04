/**
 * @fileoverview useFlowStageDetection — checks the DB to determine which
 * stages are complete for a given league.
 *
 * Used on page mount to skip past already-completed stages and drive the
 * "Continue Wizard" button's target stage on the league detail page.
 * The database is the source of truth — not localStorage.
 *
 * Stage checks (cascading):
 *   Stage 0 (League):   leagueId exists in URL      → done
 *   Stage 1 (Season):   seasons has a row           → done
 *   Stage 2 (Schedule): season_weeks has rows       → done
 *   Stage 3 (Teams):    teams has rows              → done
 *   Stage 4 (Matchups): season.status === 'active'  → done (flow complete → 5)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

interface StageDetectionResult {
  isLoading: boolean;
  /** Index of the first incomplete stage (0-based). 5 = all stages done. */
  firstIncompleteStage: number;
  /** Data discovered from the DB */
  context: {
    leagueId?: string;
    leagueStartDate?: string;
    leagueName?: string;
    gameType?: string;
    lineupSize?: number;
    rosterSize?: number;
    handicapType?: string;
    matchFormat?: string;
    dayOfWeek?: string;
    division?: string;
    seasonId?: string;
    seasonName?: string;
    seasonLength?: number;
    teamCount?: number;
    venueCount?: number;
  };
}

/**
 * Query the DB to figure out which flow stages are already complete.
 * Returns the index of the first incomplete stage (or 5 if all done).
 */
export function useFlowStageDetection(leagueId: string | null): StageDetectionResult {
  const { data, isLoading } = useQuery({
    queryKey: ['flow-stage-detection', leagueId],
    queryFn: async () => {
      if (!leagueId) return null;

      // Fetch league details (needed by Season wizard + summary display)
      const { data: league } = await supabase
        .from('leagues')
        .select('league_start_date, game_type, division, day_of_week')
        .eq('id', leagueId)
        .single();

      // Fetch modular preferences (new-system fields: lineup/roster/handicap).
      // These live in the preferences table keyed by entity_type='league'.
      const { data: prefs } = await supabase
        .from('preferences')
        .select('lineup_size, max_roster_size, game_generation, handicap_type')
        .eq('entity_type', 'league')
        .eq('entity_id', leagueId)
        .maybeSingle();

      // Fetch the most-recent season for this league (if any)
      const { data: season } = await supabase
        .from('seasons')
        .select('id, status, season_name, season_length, start_date')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If a season exists, check downstream stage progress in parallel
      let hasSchedule = false;
      let hasTeams = false;
      let teamCount = 0;
      let venueCount = 0;
      if (season?.id) {
        const [weeksRes, teamsRes] = await Promise.all([
          supabase
            .from('season_weeks')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', season.id),
          supabase
            .from('teams')
            .select('home_venue_id', { count: 'exact' })
            .eq('season_id', season.id)
            .eq('status', 'active'),
        ]);
        hasSchedule = (weeksRes.count ?? 0) > 0;
        teamCount = teamsRes.count ?? 0;
        hasTeams = teamCount > 0;
        // Count distinct venues the teams play out of
        const venueIds = new Set(
          (teamsRes.data ?? [])
            .map((t) => t.home_venue_id)
            .filter((v): v is string => Boolean(v)),
        );
        venueCount = venueIds.size;
      }

      // Build the league name from its fields
      const gameTypeMap: Record<string, string> = {
        eight_ball: '8 Ball', nine_ball: '9 Ball', ten_ball: '10 Ball',
      };
      const gameType = league?.game_type ?? '';
      const dayOfWeek = league?.day_of_week ?? '';
      const dayCapitalized = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
      const nameParts = [gameTypeMap[gameType] ?? gameType, dayCapitalized, league?.division].filter(Boolean);
      const leagueName = nameParts.join(' ');

      return {
        leagueStartDate: league?.league_start_date ?? null,
        leagueName: leagueName || null,
        gameType: gameType || null,
        lineupSize: prefs?.lineup_size ?? null,
        rosterSize: prefs?.max_roster_size ?? null,
        handicapType: prefs?.handicap_type ?? null,
        matchFormat: prefs?.game_generation ?? null,
        dayOfWeek: dayOfWeek || null,
        division: league?.division ?? null,
        seasonId: season?.id ?? null,
        seasonName: season?.season_name ?? null,
        seasonLength: season?.season_length ?? null,
        seasonActive: season?.status === 'active',
        hasSchedule,
        hasTeams,
        teamCount,
        venueCount,
      };
    },
    enabled: !!leagueId,
    staleTime: 0, // Always check fresh
  });

  // No leagueId = start at stage 0 (league creation)
  if (!leagueId) {
    return { isLoading: false, firstIncompleteStage: 0, context: {} };
  }

  // LeagueId exists = stage 0 done; while fetching, hold on stage 1
  if (isLoading) {
    return { isLoading: true, firstIncompleteStage: 1, context: { leagueId } };
  }

  const leagueStartDate = data?.leagueStartDate ?? undefined;
  const leagueName = data?.leagueName ?? undefined;
  const gameType = data?.gameType ?? undefined;
  const lineupSize = data?.lineupSize ?? undefined;
  const rosterSize = data?.rosterSize ?? undefined;
  const handicapType = data?.handicapType ?? undefined;
  const matchFormat = data?.matchFormat ?? undefined;
  const dayOfWeek = data?.dayOfWeek ?? undefined;
  const division = data?.division ?? undefined;

  const baseCtx = {
    leagueId, leagueStartDate, leagueName, gameType,
    lineupSize, rosterSize, handicapType, matchFormat,
    dayOfWeek, division,
  };

  // Stage 1 check: season exists?
  if (!data?.seasonId) {
    return { isLoading: false, firstIncompleteStage: 1, context: baseCtx };
  }

  const ctx = {
    ...baseCtx,
    seasonId: data.seasonId,
    seasonName: data.seasonName ?? undefined,
    seasonLength: data.seasonLength ?? undefined,
    scheduleComplete: data.hasSchedule,
    teamCount: data.teamCount || undefined,
    venueCount: data.venueCount || undefined,
  };

  // Stage 4 check: season activated (matchups finished) — everything done
  if (data.seasonActive) {
    return { isLoading: false, firstIncompleteStage: 5, context: ctx };
  }

  // Stage 2 check: schedule weeks exist?
  if (!data.hasSchedule) {
    return { isLoading: false, firstIncompleteStage: 2, context: ctx };
  }

  // Stage 3 check: teams exist?
  if (!data.hasTeams) {
    return { isLoading: false, firstIncompleteStage: 3, context: ctx };
  }

  // Schedule + teams both exist, season not yet active → resume at matchups
  return { isLoading: false, firstIncompleteStage: 4, context: ctx };
}
