/**
 * @fileoverview A player's places in RESOLVED tiebreakers — Unit 5 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * Ed's anti-sandbagging rule (requirement D1): a tiebreak WIN counts toward the
 * handicap, a tiebreak LOSS never does. The credit is read from the tiebreak
 * record, not from game rows (D2): the credited players ARE the winning side's
 * tiebreak lineup, frozen on the record. One slot = one credited win, so a
 * double-duty player in two slots is credited twice — exactly as the old
 * three-game overwrite did.
 *
 * Losing slots are returned too (as `won: false`). The handicap history drops
 * them, but only AFTER they have taken their place in the newest-N window — the
 * old overwritten loss rows did the same, and parity needs that window
 * identical (see src/api/queries/matchGames.ts).
 */

import { supabase } from '@/supabaseClient';

/** One tiebreak slot a player filled. */
export interface TiebreakSlot {
  /** When the tiebreak was created — orders it among regular games. */
  at: string;
  /** True when the player's side won the tiebreaker (a credited win). */
  won: boolean;
}

const SLOTS = [1, 2, 3, 4, 5] as const;

/**
 * Fetch every slot this player filled in a resolved tiebreaker of one game type.
 *
 * @param playerId - members.id
 * @param gameType - Only tiebreakers frozen with this game type count
 * @param leagueId - Optional: only tiebreakers in this league (any season)
 * @returns One entry per slot (up to players_per_side), newest first
 * @throws On a database error
 *
 * @example
 * // John played slots 1 and 3 (double duty) for the side that won:
 * await fetchTiebreakSlots(john, 'eight_ball') // [{at, won:true}, {at, won:true}]
 */
export async function fetchTiebreakSlots(
  playerId: string,
  gameType: string,
  leagueId?: string,
): Promise<TiebreakSlot[]> {
  // From the tiebreaker down to its lineups (one-to-many), so the embed is a
  // real array. !inner + the lineup filter keep only tiebreakers this player
  // was in, and only the lineup(s) holding them.
  let query = supabase
    .from('match_tiebreakers')
    .select(
      'created_at, players_per_side, winning_team_id, match:matches!inner(season:seasons!inner(league_id)), lineups:match_tiebreaker_lineups!inner(team_id, player1_id, player2_id, player3_id, player4_id, player5_id)',
    )
    .eq('game_type', gameType)
    // Unresolved tiebreakers credit nobody yet.
    .not('winning_team_id', 'is', null)
    .or(SLOTS.map((n) => `player${n}_id.eq.${playerId}`).join(','), { referencedTable: 'lineups' });
  if (leagueId) query = query.eq('match.season.league_id', leagueId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch tiebreak slots: ${error.message}`);

  const slots: TiebreakSlot[] = [];
  for (const tb of data ?? []) {
    for (const lineup of tb.lineups) {
      for (const n of SLOTS) {
        // Only participating slots: never past players_per_side.
        if (n <= tb.players_per_side && lineup[`player${n}_id`] === playerId) {
          slots.push({ at: tb.created_at, won: lineup.team_id === tb.winning_team_id });
        }
      }
    }
  }
  return slots.sort((a, b) => b.at.localeCompare(a.at));
}
