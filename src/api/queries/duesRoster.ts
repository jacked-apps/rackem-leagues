/**
 * @fileoverview League dues roster query.
 *
 * Fetches the roster of a single league — the players an operator needs to
 * track annual (BCA) dues for — scoped to the league's CURRENT play. Sanctioning
 * is per league, so this is deliberately league-scoped (not org-wide): an
 * operator may run one sanctioned league and one unsanctioned one and only owes
 * dues tracking on the sanctioned side.
 *
 * "Current roster" = players on teams in this league's active or upcoming
 * seasons. Players from finished past seasons are intentionally excluded so the
 * roster reflects who is actually playing now and expected to be paid up.
 */

import { supabase } from '@/supabaseClient';

/** One player row on the dues roster. */
export interface DuesRosterPlayer {
  readonly id: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly nickname: string | null;
  /** null → unregistered placeholder; drives the PlayerNameLink badge. */
  readonly user_id: string | null;
  readonly bca_member_number: string | null;
  /** ISO date dues were last recorded, or null if never. */
  readonly membership_paid_date: string | null;
}

/**
 * Fetch the current-season roster for one league, with each player's dues date.
 *
 * @param leagueId - League primary key
 * @returns members (deduped) on active/upcoming-season teams in the league,
 *          ordered by last name; empty array when the league has no current
 *          roster (e.g. between seasons).
 */
export async function fetchLeagueDuesRoster(
  leagueId: string,
): Promise<DuesRosterPlayer[]> {
  // Member IDs on teams in this league's active/upcoming seasons.
  const { data: teamPlayers, error: tpError } = await supabase
    .from('team_players')
    .select('member_id, team:teams!inner(league_id, season:seasons!inner(status))')
    .eq('team.league_id', leagueId)
    .in('team.season.status', ['active', 'upcoming']);

  if (tpError) throw tpError;

  const memberIds = [...new Set((teamPlayers ?? []).map((tp) => tp.member_id))];
  if (memberIds.length === 0) return [];

  const { data: members, error: mError } = await supabase
    .from('members')
    .select('id, first_name, last_name, nickname, user_id, bca_member_number, membership_paid_date')
    .in('id', memberIds)
    .order('last_name');

  if (mError) throw mError;

  return (members ?? []) as DuesRosterPlayer[];
}
