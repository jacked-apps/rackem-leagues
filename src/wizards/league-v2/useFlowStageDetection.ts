/**
 * @fileoverview useFlowStageDetection — checks the DB to determine which
 * stages are complete for a given league.
 *
 * Used on page mount to skip past already-completed stages.
 * The database is the source of truth — not localStorage.
 *
 * Checks:
 *   Stage 1 (League): leagueId exists in URL → done
 *   Stage 2 (Season): seasons table has a row for this league → done
 *   (Stages 3-5: future — schedule, teams, matchups checks)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

interface StageDetectionResult {
  isLoading: boolean;
  /** Index of the first incomplete stage (0-based) */
  firstIncompleteStage: number;
  /** Data discovered from the DB */
  context: {
    leagueId?: string;
    leagueStartDate?: string;
    leagueName?: string;
    gameType?: string;
    leagueFormat?: string;
    dayOfWeek?: string;
    division?: string;
    seasonId?: string;
  };
}

/**
 * Query the DB to figure out which flow stages are already complete.
 * Returns the index of the first incomplete stage.
 */
export function useFlowStageDetection(leagueId: string | null): StageDetectionResult {
  const { data, isLoading } = useQuery({
    queryKey: ['flow-stage-detection', leagueId],
    queryFn: async () => {
      if (!leagueId) return { leagueStartDate: null, seasonId: null };

      // Fetch league details (needed by Season wizard + summary display)
      const { data: league } = await supabase
        .from('leagues')
        .select('league_start_date, game_type, team_format, division, day_of_week')
        .eq('id', leagueId)
        .single();

      // Check if a season exists for this league
      const { data: season } = await supabase
        .from('seasons')
        .select('id')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
        leagueFormat: league?.team_format ?? null,
        dayOfWeek: dayOfWeek || null,
        division: league?.division ?? null,
        seasonId: season?.id ?? null,
      };
    },
    enabled: !!leagueId,
    staleTime: 0, // Always check fresh
  });

  // No leagueId = start at stage 0 (league creation)
  if (!leagueId) {
    return { isLoading: false, firstIncompleteStage: 0, context: {} };
  }

  // LeagueId exists = stage 0 is done
  if (isLoading) {
    return { isLoading: true, firstIncompleteStage: 1, context: { leagueId } };
  }

  const leagueStartDate = data?.leagueStartDate ?? undefined;

  const leagueName = data?.leagueName ?? undefined;
  const gameType = data?.gameType ?? undefined;
  const leagueFormat = data?.leagueFormat ?? undefined;

  const dayOfWeek = data?.dayOfWeek ?? undefined;
  const division = data?.division ?? undefined;

  // Check season
  if (!data?.seasonId) {
    return {
      isLoading: false,
      firstIncompleteStage: 1,
      context: { leagueId, leagueStartDate, leagueName, gameType, leagueFormat, dayOfWeek, division },
    };
  }

  // Season exists = stage 1 done, check further stages later
  return {
    isLoading: false,
    firstIncompleteStage: 2,
    context: { leagueId, leagueStartDate, leagueName, gameType, leagueFormat, dayOfWeek, division, seasonId: data.seasonId },
  };
}
