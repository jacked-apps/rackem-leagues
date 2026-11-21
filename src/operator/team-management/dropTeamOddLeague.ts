/**
 * @fileoverview Drop a team from a league that ALREADY has a BYE (odd team
 * count), pre-season or mid-season.
 *
 * Gathers what the planner needs (the season's matches with their week dates,
 * the BYE team, the real standings order), builds the re-pairing plan with
 * planOddLeagueDrop (Ed's hybrid + home/away rule), and hands it to the
 * `apply_odd_league_drop` RPC, which re-checks it and applies it in one
 * transaction. If the schedule changed in between, the RPC refuses and nothing
 * changes.
 *
 * The even-league case stays on `drop_team_mid_season` / `convertTeamToBye`.
 */

import { supabase } from '@/supabaseClient';
import { fetchSeasonStandings } from '@/api/queries/standings';
import { sortStandings } from '@/utils/standings/sortStandings';
import { planOddLeagueDrop, type DropPlanMatch } from './planOddLeagueDrop';

/**
 * The season's BYE team id, or null for an even league.
 *
 * @param seasonId - Season to look in
 */
export async function fetchSeasonByeTeamId(seasonId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('id')
    .eq('season_id', seasonId)
    .eq('status', 'bye')
    .limit(1);
  if (error) throw new Error(`Failed to check for a BYE: ${error.message}`);
  return data?.[0]?.id ?? null;
}

/**
 * Every match of the season in planner shape. A match counts as "started"
 * (never changed) once it has any status but 'scheduled', a winner, or a
 * locked lineup: the same test the RPC applies.
 */
async function fetchPlanMatches(seasonId: string): Promise<DropPlanMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, season_week_id, home_team_id, away_team_id, status, winner_team_id, season_weeks(scheduled_date), match_lineups!match_lineups_match_id_fkey(locked)')
    .eq('season_id', seasonId);
  if (error) throw new Error(`Failed to load the schedule: ${error.message}`);
  return (data ?? [])
    // Playoff placeholders (no team yet) are not part of the round-robin.
    .filter((m) => m.home_team_id && m.away_team_id && m.season_week_id)
    .map((m) => ({
      id: m.id,
      weekId: m.season_week_id!,
      weekDate: m.season_weeks?.scheduled_date ?? '',
      homeTeamId: m.home_team_id!,
      awayTeamId: m.away_team_id!,
      started: m.status !== 'scheduled' || m.winner_team_id !== null || (m.match_lineups ?? []).some((l) => l.locked),
    }));
}

/**
 * Plan and apply the drop.
 *
 * @param teamId - Team leaving the league
 * @param seasonId - Its season
 * @param byeTeamId - The season's BYE (from fetchSeasonByeTeamId)
 * @returns Number of weeks whose schedule changed
 */
export async function dropTeamOddLeague(teamId: string, seasonId: string, byeTeamId: string): Promise<number> {
  const [matches, standings] = await Promise.all([fetchPlanMatches(seasonId), fetchSeasonStandings(seasonId)]);
  const standingsOrder = sortStandings(standings).map((s) => s.teamId);
  const plan = planOddLeagueDrop(matches, teamId, byeTeamId, standingsOrder);

  const { data, error } = await supabase.rpc('apply_odd_league_drop', {
    p_team_id: teamId,
    p_season_id: seasonId,
    p_updates: plan.updates.map(({ matchId, homeTeamId, awayTeamId }) => ({ matchId, homeTeamId, awayTeamId })),
    p_rewire_ids: plan.rewireToBye.map((r) => r.matchId),
    p_delete_ids: plan.deleteMatchIds,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}
