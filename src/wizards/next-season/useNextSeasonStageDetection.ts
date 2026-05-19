/**
 * @fileoverview Stage detection for the "Start Next Season" flow.
 *
 * Mirrors `useFlowStageDetection` from the first-time flow but
 * scoped to the next-season's 4-stage shape and gated on the latest
 * UPCOMING season (not the most recent ANY-status season).
 *
 * Stage indexes (relative to createNextSeasonFlow):
 *   0 (Season):    no upcoming season yet                 → start here
 *   1 (Schedule):  upcoming season exists, no weeks       → resume here
 *   2 (Teams):     weeks exist, no teams                  → resume here
 *   3 (Matchups):  teams exist, season still 'upcoming'   → resume here
 *   (4)            season status === 'active'             → flow complete
 *
 * Returns the league row + the upcoming season row (if any) packed
 * into a flow context shape that pre-fills the wizards downstream.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

interface NextSeasonStageDetectionResult {
  isLoading: boolean;
  firstIncompleteStage: number;
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
    /** ISO date of the last `season_weeks` row (regular OR playoffs) for the
     *  most-recent non-upcoming season in this league. Drives the
     *  next-season start-date picker's "Start immediately / Week off /
     *  Custom" choices. Undefined for first-time leagues (no prior season). */
    previousSeasonLastWeekDate?: string;
  };
}

export function useNextSeasonStageDetection(
  leagueId: string | null | undefined,
): NextSeasonStageDetectionResult {
  const { data, isLoading } = useQuery({
    queryKey: ['next-season-stage-detection', leagueId],
    queryFn: async () => {
      if (!leagueId) return null;

      // League row + prefs — same as the first-time detection.
      const [{ data: league }, { data: prefs }] = await Promise.all([
        supabase
          .from('leagues')
          .select('league_start_date, game_type, division, day_of_week')
          .eq('id', leagueId)
          .single(),
        supabase
          .from('preferences')
          .select('lineup_size, max_roster_size, game_generation, handicap_type')
          .eq('entity_type', 'league')
          .eq('entity_id', leagueId)
          .maybeSingle(),
      ]);

      // Look for an UPCOMING season for this league. If one exists,
      // we're resuming mid-setup. If not, we're starting fresh.
      const { data: upcomingSeason } = await supabase
        .from('seasons')
        .select('id, status, season_name, season_length, start_date')
        .eq('league_id', leagueId)
        .eq('status', 'upcoming')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Most-recent non-upcoming season for THIS league. Used to compute
      // the "last week played" date that anchors the next-season start
      // date choices. Skip 'upcoming' since that IS the one being built.
      const { data: previousSeasonForDates } = await supabase
        .from('seasons')
        .select('id')
        .eq('league_id', leagueId)
        .in('status', ['active', 'completed'])
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Last scheduled_date across ALL week types (regular + playoffs) for
      // that previous season. Caps the "last week played" calculation.
      let previousSeasonLastWeekDate: string | undefined;
      if (previousSeasonForDates?.id) {
        const { data: lastWeek } = await supabase
          .from('season_weeks')
          .select('scheduled_date')
          .eq('season_id', previousSeasonForDates.id)
          .order('scheduled_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        previousSeasonLastWeekDate = lastWeek?.scheduled_date ?? undefined;
      }

      // Downstream progress checks (only meaningful if we have an
      // upcoming season).
      let hasSchedule = false;
      let teamCount = 0;
      let venueCount = 0;
      if (upcomingSeason?.id) {
        const [weeksRes, teamsRes] = await Promise.all([
          supabase
            .from('season_weeks')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', upcomingSeason.id),
          supabase
            .from('teams')
            .select('home_venue_id', { count: 'exact' })
            .eq('season_id', upcomingSeason.id)
            .eq('status', 'active'),
        ]);
        hasSchedule = (weeksRes.count ?? 0) > 0;
        teamCount = teamsRes.count ?? 0;
        const venueIds = new Set(
          (teamsRes.data ?? [])
            .map((t: { home_venue_id: string | null }) => t.home_venue_id)
            .filter(Boolean) as string[],
        );
        venueCount = venueIds.size;
      }

      return {
        league,
        prefs,
        upcomingSeason,
        hasSchedule,
        teamCount,
        venueCount,
        previousSeasonLastWeekDate,
      };
    },
    enabled: !!leagueId,
  });

  if (isLoading || !data) {
    return {
      isLoading: true,
      firstIncompleteStage: 0,
      context: leagueId ? { leagueId } : {},
    };
  }

  const { league, prefs, upcomingSeason, hasSchedule, teamCount, venueCount, previousSeasonLastWeekDate } = data;

  // Resolve stage. With NO upcoming season, the operator starts at
  // stage 0 (Season). With one in progress, walk the cascade.
  let firstIncompleteStage = 0;
  if (upcomingSeason) {
    firstIncompleteStage = 1; // Schedule by default
    if (hasSchedule) firstIncompleteStage = 2; // Teams
    if (teamCount > 0) firstIncompleteStage = 3; // Matchups
    if (upcomingSeason.status !== 'upcoming') firstIncompleteStage = 4; // Done
  }

  return {
    isLoading: false,
    firstIncompleteStage,
    context: {
      leagueId: leagueId ?? undefined,
      leagueStartDate: league?.league_start_date,
      gameType: league?.game_type,
      dayOfWeek: league?.day_of_week,
      division: league?.division ?? undefined,
      lineupSize: prefs?.lineup_size,
      rosterSize: prefs?.max_roster_size,
      handicapType: prefs?.handicap_type,
      matchFormat: prefs?.game_generation,
      seasonId: upcomingSeason?.id,
      seasonName: upcomingSeason?.season_name,
      seasonLength: upcomingSeason?.season_length,
      teamCount: teamCount || undefined,
      venueCount: venueCount || undefined,
      previousSeasonLastWeekDate,
    },
  };
}
