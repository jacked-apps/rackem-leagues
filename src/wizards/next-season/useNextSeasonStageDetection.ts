/**
 * @fileoverview Stage detection for the "Create Next Season" flow.
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
import type { ReupResponseContextEntry } from '@/components/wizard';
import { buildLeagueTitle } from '@/utils/leagueUtils';

interface NextSeasonStageDetectionResult {
  isLoading: boolean;
  firstIncompleteStage: number;
  context: {
    organizationId?: string;
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
    seasonStartDate?: string;
    seasonLength?: number;
    playoffWeeks?: number;
    scheduleComplete?: boolean;
    teamCount?: number;
    venueCount?: number;
    /** ISO date of the last `season_weeks` row (regular OR playoffs) for the
     *  most-recent non-upcoming season in this league. Drives the
     *  next-season start-date picker's "Start immediately / Week off /
     *  Custom" choices. Undefined for first-time leagues (no prior season). */
    previousSeasonLastWeekDate?: string;
    /** Regular-season week count of the previous season. Drives the
     *  Season Length step's "Same as last (X weeks)" choice. Undefined
     *  for first-time leagues. */
    previousSeasonLength?: number;
    /** Count of `season_weeks` rows with week_type='playoffs' for the
     *  previous season. Drives the Playoff Format step's "Same as
     *  last (N playoff weeks)" choice. 0 = no playoffs, 1 = 1-week, 2 =
     *  2-week. Undefined for first-time leagues. */
    previousSeasonPlayoffWeeks?: number;
    /** Org-level championship tracking preferences (saved once at first
     *  league creation, carried forward to every subsequent league/season).
     *  Drives:
     *    - ChampionshipStep's "Keep tracking (dates) / Change" radio
     *    - The whole step's `showIf` (hides when neither BCA nor APA
     *      is tracked, so operators who said "don't bother" aren't
     *      re-asked every season). */
    championshipTracking?: {
      trackBca: boolean;
      trackApa: boolean;
      bcaDates?: string;
      apaDates?: string;
    };
    /** Unique venue IDs used by the previous season's active teams.
     *  Drives the Teams wizard's "Same venues?" gate (next-season
     *  only). Undefined for first-time leagues. */
    previousSeasonVenueIds?: string[];
    reupResponses?: ReupResponseContextEntry[];
  };
}

export function useNextSeasonStageDetection(
  leagueId: string | null | undefined,
): NextSeasonStageDetectionResult {
  const { data, isLoading } = useQuery({
    queryKey: ['next-season-stage-detection', leagueId],
    queryFn: async () => {
      if (!leagueId) return null;

      // League row + prefs — same as the first-time detection. Also
      // pull organization_id so we can look up the operator's saved
      // championship preferences (set once at first-league creation)
      // AND so the wizard's step components can read it via flow
      // context (the next-season route doesn't have orgId in it).
      const [{ data: league }, { data: prefs }] = await Promise.all([
        supabase
          .from('leagues')
          .select('league_start_date, game_type, division, day_of_week, organization_id')
          .eq('id', leagueId)
          .single(),
        supabase
          .from('preferences')
          .select('lineup_size, max_roster_size, game_generation, handicap_type')
          .eq('entity_type', 'league')
          .eq('entity_id', leagueId)
          .maybeSingle(),
      ]);

      // Operator's championship tracking preferences. We "already know"
      // the answer from the first league this operator set up — no need
      // to re-ask unless they want to change. Empty array means the
      // operator hasn't opted into tracking anything; the schedule
      // wizard's championship step is hidden in that case.
      let championshipTracking:
        | { trackBca: boolean; trackApa: boolean; bcaDates?: string; apaDates?: string }
        | undefined;
      if (league?.organization_id) {
        const { data: champPrefs } = await supabase
          .from('operator_blackout_preferences')
          .select('preference_action, championship_date_options(organization, start_date, end_date, year)')
          .eq('organization_id', league.organization_id)
          .eq('preference_type', 'championship');

        const blackouts = (champPrefs ?? []).filter(
          (p) => p.preference_action === 'blackout' && p.championship_date_options,
        );
        // Pick the most recent year's row per organization (BCA / APA).
        const byOrg = new Map<string, { start_date: string; end_date: string; year: number }>();
        for (const p of blackouts) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = p.championship_date_options as any;
          const existing = byOrg.get(c.organization);
          if (!existing || c.year > existing.year) {
            byOrg.set(c.organization, {
              start_date: c.start_date,
              end_date: c.end_date,
              year: c.year,
            });
          }
        }
        const bca = byOrg.get('BCA');
        const apa = byOrg.get('APA');
        championshipTracking = {
          trackBca: !!bca,
          trackApa: !!apa,
          bcaDates: bca ? `${bca.start_date} – ${bca.end_date}` : undefined,
          apaDates: apa ? `${apa.start_date} – ${apa.end_date}` : undefined,
        };
      }

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

      // Most-recent non-upcoming season for THIS league. Drives all three
      // pre-fills downstream: the start-date anchors (last-week-played
      // +7/+14/+21), the Season Length "Same as last" choice, and the
      // Teams stage's re-up pre-fill. Skip 'upcoming' since that IS the
      // one we're building.
      const { data: previousSeason } = await supabase
        .from('seasons')
        .select('id, season_length')
        .eq('league_id', leagueId)
        .in('status', ['active', 'completed'])
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      const previousSeasonLength: number | undefined =
        previousSeason?.season_length ?? undefined;

      // for the previous season, PLUS the count of playoff weeks, AND
      // re-up responses + previous teams + venue IDs. Only when a
      // previous season exists — first-time leagues have nothing to
      // carry forward.
      let previousSeasonLastWeekDate: string | undefined;
      let previousSeasonPlayoffWeeks: number | undefined;
      let previousSeasonVenueIds: string[] | undefined;
      let reupResponses: ReupResponseContextEntry[] = [];
      if (previousSeason?.id) {
        const [
          { data: lastWeek },
          { count: playoffWeekCount },
          { data: prevTeams },
          { data: responses },
        ] = await Promise.all([
          supabase
            .from('season_weeks')
            .select('scheduled_date')
            .eq('season_id', previousSeason.id)
            .order('scheduled_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('season_weeks')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', previousSeason.id)
            .eq('week_type', 'playoffs'),
          supabase
            .from('teams')
            .select('id, team_name, home_venue_id, captain_id')
            .eq('season_id', previousSeason.id)
            .eq('status', 'active'),
          supabase
            .from('season_reup_responses')
            .select('team_id, returning_next_season, next_captain_id, submitted_at')
            .eq('season_id', previousSeason.id),
        ]);
        previousSeasonLastWeekDate = lastWeek?.scheduled_date ?? undefined;
        previousSeasonPlayoffWeeks = playoffWeekCount ?? 0;

        // Look up captain display names so the captains-mode gate can
        // show "TeamName — CaptainName — confirmed?" rows. We collect
        // captain IDs from BOTH the current captain (teams.captain_id)
        // and any re-up "next_captain_id" answers so a captain swap is
        // displayable too.
        const captainIds = new Set<string>();
        for (const t of (prevTeams ?? []) as { captain_id: string | null }[]) {
          if (t.captain_id) captainIds.add(t.captain_id);
        }
        for (const r of responses ?? []) {
          if (r.next_captain_id) captainIds.add(r.next_captain_id);
        }
        let captainNameById = new Map<string, string>();
        if (captainIds.size > 0) {
          const { data: members } = await supabase
            .from('members')
            .select('id, first_name, last_name')
            .in('id', Array.from(captainIds));
          captainNameById = new Map(
            (members ?? []).map((m: { id: string; first_name: string | null; last_name: string | null }) => [
              m.id,
              [m.first_name, m.last_name].filter(Boolean).join(' '),
            ]),
          );
        }

        const responsesByTeamId = new Map<string, { returning_next_season: boolean | null; next_captain_id: string | null; submitted_at: string | null }>();
        for (const r of responses ?? []) {
          responsesByTeamId.set(r.team_id, {
            returning_next_season: r.returning_next_season,
            next_captain_id: r.next_captain_id,
            submitted_at: r.submitted_at,
          });
        }
        // Derive unique venue IDs used by the previous season's
        // active teams. Drives the Teams wizard's "Same venues?" gate.
        previousSeasonVenueIds = Array.from(
          new Set(
            (prevTeams ?? [])
              .map((t: { home_venue_id: string | null }) => t.home_venue_id)
              .filter((id: string | null): id is string => !!id),
          ),
        );
        reupResponses = (prevTeams ?? []).map((t: { id: string; team_name: string; home_venue_id: string | null; captain_id: string | null }) => {
          const r = responsesByTeamId.get(t.id);
          return {
            sourceTeamId: t.id,
            teamName: t.team_name,
            captainName: t.captain_id ? (captainNameById.get(t.captain_id) ?? '') : '',
            currentCaptainId: t.captain_id ?? null,
            // No submission yet → returningNextSeason is null (Teams
            // step treats this as "not returning + warn"). Submitted
            // → use the actual answer.
            returningNextSeason: r?.submitted_at ? (r.returning_next_season ?? null) : null,
            nextCaptainId: r?.submitted_at ? (r.next_captain_id ?? null) : null,
          };
        });
      }

      // Downstream progress checks (only meaningful if we have an
      // upcoming season).
      let hasSchedule = false;
      let upcomingPlayoffWeeks: number | undefined;
      let teamCount = 0;
      let venueCount = 0;
      if (upcomingSeason?.id) {
        const [weeksRes, playoffWeeksRes, teamsRes] = await Promise.all([
          supabase
            .from('season_weeks')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', upcomingSeason.id),
          supabase
            .from('season_weeks')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', upcomingSeason.id)
            .eq('week_type', 'playoffs'),
          supabase
            .from('teams')
            .select('home_venue_id', { count: 'exact' })
            .eq('season_id', upcomingSeason.id)
            .eq('status', 'active'),
        ]);
        hasSchedule = (weeksRes.count ?? 0) > 0;
        upcomingPlayoffWeeks = playoffWeeksRes.count ?? 0;
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
        upcomingPlayoffWeeks,
        teamCount,
        venueCount,
        previousSeasonLastWeekDate,
        previousSeasonLength,
        previousSeasonPlayoffWeeks,
        championshipTracking,
        previousSeasonVenueIds,
        reupResponses,
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

  const { league, prefs, upcomingSeason, hasSchedule, upcomingPlayoffWeeks, teamCount, venueCount, previousSeasonLastWeekDate, previousSeasonLength, previousSeasonPlayoffWeeks, championshipTracking, previousSeasonVenueIds, reupResponses } = data;

  // Build league name from its parts (same convention used everywhere else).
  const leagueName = buildLeagueTitle({
    gameType: league?.game_type,
    dayOfWeek: league?.day_of_week,
    division: league?.division,
  });

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
      organizationId: league?.organization_id ?? undefined,
      leagueId: leagueId ?? undefined,
      leagueName: leagueName || undefined,
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
      seasonStartDate: upcomingSeason?.start_date ?? undefined,
      seasonLength: upcomingSeason?.season_length,
      playoffWeeks: upcomingPlayoffWeeks,
      scheduleComplete: hasSchedule || undefined,
      teamCount: teamCount || undefined,
      venueCount: venueCount || undefined,
      previousSeasonLastWeekDate,
      previousSeasonLength,
      previousSeasonPlayoffWeeks,
      championshipTracking,
      previousSeasonVenueIds: previousSeasonVenueIds?.length ? previousSeasonVenueIds : undefined,
      reupResponses: reupResponses?.length ? reupResponses : undefined,
    },
  };
}
