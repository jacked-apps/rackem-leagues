/**
 * @fileoverview Query the LO status card uses to render per-team
 * re-up response state during the 3-week window.
 *
 * Returns one entry per ACTIVE team in the league's current active
 * season. Each entry has its own response state (returning / not
 * returning / no answer yet), so the card can render the right icon
 * + label per row.
 */

import { supabase } from '@/supabaseClient';

export type ReupResponseState =
  | { kind: 'returning_same'; submittedAt: string }
  | { kind: 'returning_new_captain'; submittedAt: string; nextCaptainName: string }
  | { kind: 'not_returning'; submittedAt: string }
  | { kind: 'no_response' };

export interface LeagueReupStatusEntry {
  teamId: string;
  teamName: string;
  captainName: string | null;
  state: ReupResponseState;
}

export interface LeagueReupStatus {
  /** True if the league has an active season that ends within the
   *  next 21 days. The status card should only render when this is
   *  true — outside the window, no card. */
  withinWindow: boolean;
  seasonEndDate: string | null;
  entries: LeagueReupStatusEntry[];
  countSubmitted: number;
  countNoResponse: number;
}

export async function getLeagueReupStatus(
  leagueId: string,
): Promise<LeagueReupStatus> {
  // Active season (the one that's about to end)
  const { data: season } = await supabase
    .from('seasons')
    .select('id, end_date, status')
    .eq('league_id', leagueId)
    .eq('status', 'active')
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return { withinWindow: false, seasonEndDate: null, entries: [], countSubmitted: 0, countNoResponse: 0 };
  }

  const endDate = new Date(season.end_date);
  const now = new Date();
  const daysUntilEnd = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilEnd > 21) {
    return { withinWindow: false, seasonEndDate: season.end_date, entries: [], countSubmitted: 0, countNoResponse: 0 };
  }

  // Active teams in this season + each team's captain
  const { data: teams } = await supabase
    .from('teams')
    .select(`id, team_name, captain_id,
             captain:members!captain_id(first_name, last_name)`)
    .eq('season_id', season.id)
    .eq('status', 'active')
    .order('team_name', { ascending: true });

  // Re-up responses for those teams
  const teamIds = (teams ?? []).map((t: any) => t.id);
  const { data: responses } = teamIds.length > 0
    ? await supabase
        .from('season_reup_responses')
        .select(`team_id, returning_next_season, next_captain_id, submitted_at,
                 next_captain:members!next_captain_id(first_name, last_name)`)
        .eq('season_id', season.id)
        .in('team_id', teamIds)
    : { data: [] as any[] };

  const byTeamId = new Map<string, any>();
  for (const r of responses ?? []) byTeamId.set(r.team_id, r);

  let countSubmitted = 0;
  let countNoResponse = 0;
  const entries: LeagueReupStatusEntry[] = (teams ?? []).map((t: any) => {
    const captainRaw = Array.isArray(t.captain) ? t.captain[0] : t.captain;
    const captainName = captainRaw
      ? `${captainRaw.first_name} ${captainRaw.last_name}`
      : null;
    const r = byTeamId.get(t.id);

    let state: ReupResponseState;
    if (!r || !r.submitted_at) {
      state = { kind: 'no_response' };
      countNoResponse++;
    } else if (r.returning_next_season === false) {
      state = { kind: 'not_returning', submittedAt: r.submitted_at };
      countSubmitted++;
    } else if (r.next_captain_id && r.next_captain_id !== t.captain_id) {
      const nextRaw = Array.isArray(r.next_captain) ? r.next_captain[0] : r.next_captain;
      state = {
        kind: 'returning_new_captain',
        submittedAt: r.submitted_at,
        nextCaptainName: nextRaw
          ? `${nextRaw.first_name} ${nextRaw.last_name}`
          : 'unknown',
      };
      countSubmitted++;
    } else {
      state = { kind: 'returning_same', submittedAt: r.submitted_at };
      countSubmitted++;
    }

    return { teamId: t.id, teamName: t.team_name, captainName, state };
  });

  return {
    withinWindow: true,
    seasonEndDate: season.end_date,
    entries,
    countSubmitted,
    countNoResponse,
  };
}
