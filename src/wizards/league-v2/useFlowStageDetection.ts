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

      // Fetch the league's start date (needed by the Season wizard)
      const { data: league } = await supabase
        .from('leagues')
        .select('league_start_date')
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

      return {
        leagueStartDate: league?.league_start_date ?? null,
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

  // Check season
  if (!data?.seasonId) {
    return {
      isLoading: false,
      firstIncompleteStage: 1,
      context: { leagueId, leagueStartDate },
    };
  }

  // Season exists = stage 1 done, check further stages later
  return {
    isLoading: false,
    firstIncompleteStage: 2,
    context: { leagueId, leagueStartDate, seasonId: data.seasonId },
  };
}
