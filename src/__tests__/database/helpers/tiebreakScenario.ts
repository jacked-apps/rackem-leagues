/**
 * @fileoverview A tied match with a real handicap history, playable in the OLD
 * world (tiebreak rows overwritten, no record) and then moved to the NEW world
 * (real results + a resolved tiebreak record). Drives
 * tiebreakHandicapParity.db.test.ts — Units 4–5 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 */

import { executeSql } from '@/test/dbTestUtils';
import { createTiebreakerRecord } from '@/api/mutations/tiebreakers';
import { resolveTiebreakerRecord } from '@/api/mutations/resolveTiebreaker';
import { createTieFixture, type TieFixture } from './tieFixture';

export type Side = 'home' | 'away';
const REGULAR = 180; // 60 games a player: enough for the league-scoped path (>= 50)

export interface TiebreakScenario {
  tie: TieFixture;
  /** Every distinct player in the match. */
  players: string[];
  /** Real results applied by toNewWorld (null = never played). */
  results: (Side | null)[];
  winner: Side;
  teamOf: (side: Side) => string;
  /** The tiebreak game rows as JSON, game order. */
  tiebreakRows: () => Promise<string>;
  /** Replace the overwrite with real results + a resolved record. */
  toNewWorld: () => Promise<void>;
}

/**
 * Build the OLD world: regular games, three tiebreak rows in match-lineup order,
 * overwritten as won by the winning side's match-lineup slot (the old code).
 */
export async function buildScenario(homePattern: string[], results: (Side | null)[]): Promise<TiebreakScenario> {
  const tie = await createTieFixture(homePattern);
  const teamOf = (s: Side) => (s === 'home' ? tie.homeTeam : tie.awayTeam);
  const winner: Side = results.filter((r) => r === 'home').length >= 2 ? 'home' : 'away';
  const slotOf = (s: Side, i: number) => (s === 'home' ? tie.homeSlots : tie.awaySlots)[i];

  // Regular history, ordered one second apart, a mix of wins and losses.
  await executeSql(
    `INSERT INTO match_games (match_id, game_number, home_player_id, away_player_id, winner_team_id,
        winner_player_id, home_action, away_action, game_type, created_at)
     SELECT $1, g, h, a, CASE WHEN w THEN $4::uuid ELSE $5::uuid END, CASE WHEN w THEN h ELSE a END,
        'breaks', 'racks', 'eight_ball', '2026-02-01 19:00+00'::timestamptz + g * interval '1 second'
     FROM (SELECT g, ($2::uuid[])[(g % 3) + 1] AS h, ($3::uuid[])[((g / 3) % 3) + 1] AS a,
                  ((g * 7) % 11) < 6 AS w FROM generate_series(1, ${REGULAR}) g) s`,
    [tie.match, tie.homeSlots.slice(0, 3), tie.awaySlots, tie.homeTeam, tie.awayTeam],
  );
  // The old overwrite: every tiebreak game "won" by the winner's slot player.
  for (let i = 0; i < 3; i++) {
    await executeSql(
      `INSERT INTO match_games (match_id, game_number, home_player_id, away_player_id, winner_team_id,
          winner_player_id, home_action, away_action, game_type, is_tiebreaker)
       VALUES ($1, $2, $3, $4, $5, $6, 'breaks', 'racks', 'eight_ball', true)`,
      [tie.match, REGULAR + 1 + i, slotOf('home', i), slotOf('away', i), teamOf(winner), slotOf(winner, i)],
    );
  }

  return {
    tie, results, winner, teamOf,
    players: [...new Set([...tie.homeSlots.slice(0, 3), ...tie.awaySlots])],
    tiebreakRows: async () => JSON.stringify(await executeSql(
      `SELECT to_jsonb(g) AS r FROM match_games g WHERE match_id = $1 AND is_tiebreaker ORDER BY game_number`,
      [tie.match])),
    toNewWorld: async () => {
      for (let i = 0; i < 3; i++) {
        const r = results[i];
        await executeSql(
          `UPDATE match_games SET winner_team_id = $3, winner_player_id = $4 WHERE match_id = $1 AND game_number = $2`,
          [tie.match, REGULAR + 1 + i, r ? teamOf(r) : null, r ? slotOf(r, i) : null],
        );
      }
      await createTiebreakerRecord({
        matchId: tie.match, gameType: 'eight_ball',
        shape: { gamesNeeded: 2, gameCount: 3, playersPerSide: 3 },
        homeTeamId: tie.homeTeam, awayTeamId: tie.awayTeam,
      });
      // The lineups start empty; each team picks the same order it played
      // the match in (the order the old overwrite assumed).
      for (const side of ['home', 'away'] as const) {
        await executeSql(
          `UPDATE match_tiebreaker_lineups l SET player1_id = $3, player2_id = $4, player3_id = $5
             FROM match_tiebreakers t WHERE t.id = l.tiebreaker_id AND t.match_id = $1 AND l.team_id = $2`,
          [tie.match, teamOf(side), slotOf(side, 0), slotOf(side, 1), slotOf(side, 2)],
        );
      }
      await resolveTiebreakerRecord(tie.match, teamOf(winner));
    },
  };
}
