/**
 * @fileoverview Fetch one player's complete rack-by-rack history.
 *
 * Everything the stats page needs, in three round trips, once per page load.
 * After this returns, every filter the player applies is pure array work with
 * no network at all — which is the point. A page that queries the server on
 * every filter change shows a spinner on every click by definition, and Ed's
 * requirement was "snappy and reactive, not sluggish and constant spinnerations".
 *
 * Three queries rather than one deeply-nested one: opponent names and league
 * handicap systems are small lookups over a handful of ids, and folding them
 * into the games query would mean nested embeds two and three levels deep for
 * no gain. Each of the three is simple enough to read.
 *
 * SCALE: this fetches everything. Fine to roughly 10,000 racks — about 15 years
 * of one league night. Past that the payload, not the filtering, becomes the
 * problem, and the swap is to database-side totals plus a paginated log behind
 * `gameHistorySource`. See the plan for the numbers and the trigger.
 *
 * @see docs/plans/2026-09-06-001-feat-my-stats-page-plan.md (Unit 1)
 */

import { supabase } from '@/supabaseClient';
import { toPlayerGameRows, type RawGame } from '@/stats/toPlayerGameRows';
import type { PlayerGameRow } from '@/stats/playerGameRow';

/**
 * Match statuses whose games count.
 *
 * An in-progress match is a half-finished story: its later racks have not been
 * played, and its earlier ones may still be disputed. Including them would make
 * a player's record wobble during league night.
 */
const COUNTED_STATUSES = ['completed', 'verified'] as const;

/**
 * One string literal, deliberately. Concatenating a `.select()` from pieces
 * defeats supabase-js's type inference and the result degenerates to
 * `GenericStringError` — see memory/project_build_typecheck_and_supabase_select.
 */
const GAME_SELECT = `
  id,
  game_number,
  home_player_id,
  away_player_id,
  winner_player_id,
  break_and_run,
  golden_break,
  runout,
  early_eight,
  win_by_forfeit,
  game_type,
  match:matches!inner (
    id,
    status,
    season_id,
    home_team_id,
    away_team_id,
    assigned_table_number,
    system_snapshot,
    week:season_weeks ( scheduled_date ),
    venue:venues!matches_actual_venue_id_fkey ( name ),
    scheduled_venue:venues!matches_scheduled_venue_id_fkey ( name ),
    lineups:match_lineups (
      team_id,
      player1_id, player1_handicap,
      player2_id, player2_handicap,
      player3_id, player3_handicap,
      player4_id, player4_handicap,
      player5_id, player5_handicap,
      swap_new_player_id, swap_new_player_handicap
    )
  )
`;

/** Display name, preferring a nickname the way the rest of the app does. */
function displayName(m: {
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  const full = [m.first_name, m.last_name].filter(Boolean).join(' ').trim();
  return m.nickname?.trim() || full || 'Unknown player';
}

/**
 * Every rack this member has played, newest first.
 *
 * @param memberId - The player whose history to fetch.
 * @returns Their games as flat rows. Empty when they have played none.
 * @throws If the games query fails. The two lookup queries degrade instead —
 *         a missing name or system leaves that field blank rather than losing
 *         the whole page, since neither is what the player came to see.
 */
export async function fetchPlayerGameHistory(
  memberId: string
): Promise<PlayerGameRow[]> {
  const { data: games, error } = await supabase
    .from('match_games')
    .select(GAME_SELECT)
    .or(`home_player_id.eq.${memberId},away_player_id.eq.${memberId}`)
    .eq('is_tiebreaker', false)
    .in('match.status', COUNTED_STATUSES as unknown as string[]);

  if (error) {
    throw new Error(`Failed to fetch game history: ${error.message}`);
  }
  if (!games || games.length === 0) return [];

  const raw = games as unknown as RawGame[];

  // Opponents: whichever side isn't this member.
  const opponentIds = new Set<string>();
  const seasonIds = new Set<string>();
  for (const g of raw) {
    const opponent = g.home_player_id === memberId ? g.away_player_id : g.home_player_id;
    if (opponent) opponentIds.add(opponent);
    if (g.match?.season_id) seasonIds.add(g.match.season_id);
  }

  const [playerNames, seasonHandicapSystem] = await Promise.all([
    fetchPlayerNames([...opponentIds]),
    fetchSeasonHandicapSystems([...seasonIds]),
  ]);

  return toPlayerGameRows(raw, memberId, { playerNames, seasonHandicapSystem });
}

/**
 * Names for the opponents faced.
 *
 * @param ids - Member ids.
 * @returns id → display name. Empty on failure; the mapper falls back to
 *          "Unknown player" rather than the page failing over a name.
 */
async function fetchPlayerNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;

  const { data, error } = await supabase
    .from('members')
    .select('id, first_name, last_name, nickname')
    .in('id', ids);

  if (error || !data) return names;
  for (const m of data) names.set(m.id, displayName(m));
  return names;
}

/**
 * The handicap system each season's league uses.
 *
 * Only consulted for matches whose frozen `system_snapshot` is missing — older
 * matches predating that column. Safe because `handicap_type` cannot change on
 * an existing league (Postgres trigger, `20260418000002_lock_tier1_preferences`),
 * so today's value is necessarily the one those matches were played under.
 * Narrowly this one field: the snapshot's other contents are tier-2 dials that
 * CAN change, so the league config is not a general substitute for a snapshot.
 *
 * @param seasonIds - Seasons appearing in the history.
 * @returns season id → handicap_type. Missing entries leave the system
 *          unknown, which the page shows honestly rather than guessing.
 */
async function fetchSeasonHandicapSystems(
  seasonIds: string[]
): Promise<Map<string, string | null>> {
  const systems = new Map<string, string | null>();
  if (seasonIds.length === 0) return systems;

  const { data: seasons, error: seasonError } = await supabase
    .from('seasons')
    .select('id, league_id')
    .in('id', seasonIds);

  if (seasonError || !seasons) return systems;

  const leagueIds = [...new Set(seasons.map((s) => s.league_id).filter(Boolean))];
  if (leagueIds.length === 0) return systems;

  const { data: prefs, error: prefsError } = await supabase
    .from('resolved_league_preferences')
    .select('league_id, handicap_type')
    .in('league_id', leagueIds as string[]);

  if (prefsError || !prefs) return systems;

  const byLeague = new Map(prefs.map((p) => [p.league_id, p.handicap_type]));
  for (const season of seasons) {
    systems.set(season.id, byLeague.get(season.league_id) ?? null);
  }
  return systems;
}
