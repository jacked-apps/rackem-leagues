// @vitest-environment jsdom
/**
 * @fileoverview DB round-trip for createTiebreakerRecord — Unit 2 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * A tie used to UNLOCK both match lineups (the root of audit F1). It now writes
 * a tiebreak record instead. These tests pin the three things that change
 * buys, against the real local database:
 *   - one tiebreaker + two lineups, seeded from the MATCH lineups, only the
 *     participating slots (players_per_side) filled
 *   - the match lineup rows are byte-identical afterwards — still locked, same
 *     locked_at (requirement D0: the match record is never touched)
 *   - re-firing (remount, realtime cycle, second verifier) creates nothing and
 *     never overwrites an order already chosen
 *
 * jsdom pragma: the mutation writes through supabase-js (see
 * project_happy_dom_supabase_insert_limit).
 *
 * Run: `pnpm test:run src/__tests__/database/createTiebreakerRecord`
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { createTiebreakerRecord } from '@/api/mutations/tiebreakers';
import { getMatchLineups } from '@/api/queries/matches';
import { createTieFixture, type TieFixture } from './helpers/tieFixture';

let tie: TieFixture;
const SHAPE = { gamesNeeded: 2, gameCount: 3, playersPerSide: 3 };

/** Run the mutation the way MatchEndVerification does: seeded from match lineups. */
async function fire(): Promise<string> {
  const { homeLineup, awayLineup } = await getMatchLineups(tie.match, tie.homeTeam, tie.awayTeam, false);
  return createTiebreakerRecord({
    matchId: tie.match,
    gameType: 'eight_ball',
    shape: SHAPE,
    homeLineup: homeLineup!,
    awayLineup: awayLineup!,
  });
}

beforeAll(async () => {
  // Home fills FOUR slots so we can prove only players_per_side (3) are seeded.
  tie = await createTieFixture(['a', 'b', 'c', 'd']);
});

afterAll(async () => {
  await tie?.cleanup();
  await closePostgresPool();
});

describe('createTiebreakerRecord', () => {
  let before = '';

  it('creates one tiebreaker and two lineups, seeded from the match lineups', async () => {
    before = await tie.matchLineupRows();
    const tbId = await fire();

    const tb = await executeSql(`SELECT * FROM match_tiebreakers WHERE match_id=$1`, [tie.match]);
    expect(tb).toHaveLength(1);
    expect(tb[0]).toMatchObject({ id: tbId, games_needed: 2, game_count: 3, players_per_side: 3 });

    const home = (await executeSql(
      `SELECT player1_id, player3_id, player3_handicap, player4_id, locked
         FROM match_tiebreaker_lineups WHERE tiebreaker_id = $1 AND team_id = $2`,
      [tbId, tie.homeTeam],
    ))[0];
    expect(home.player1_id).toBe(tie.homeSlots[0]);
    expect(home.player3_id).toBe(tie.homeSlots[2]);
    // Handicap COPIED from the match lineup slot (fixture gives slot 3 a 1).
    expect(Number(home.player3_handicap)).toBe(1);
    // Slot 4 played the match but is beyond players_per_side → not seeded.
    expect(home.player4_id).toBeNull();
    expect(home.locked).toBe(false);
  });

  it('leaves the match lineups byte-identical — still locked, same locked_at', async () => {
    expect(await tie.matchLineupRows()).toBe(before);
    const locks = await executeSql(`SELECT locked, locked_at FROM match_lineups WHERE match_id=$1`, [tie.match]);
    expect(locks.every((l: { locked: boolean; locked_at: string | null }) => l.locked && l.locked_at)).toBe(true);
  });

  it('re-firing creates nothing and keeps an order already chosen', async () => {
    // Someone on the home team reorders: swap slots 1 and 2.
    await executeSql(
      `UPDATE match_tiebreaker_lineups SET player1_id = player2_id, player2_id = player1_id WHERE team_id = $1`,
      [tie.homeTeam],
    );
    const pickRow = `SELECT to_jsonb(t) - 'updated_at' AS r FROM match_tiebreaker_lineups t WHERE team_id=$1`;
    const chosen = await executeSql(pickRow, [tie.homeTeam]);

    await fire();
    await fire();

    const counts = await executeSql(
      `SELECT (SELECT count(*) FROM match_tiebreakers WHERE match_id=$1)::int AS tb,
              (SELECT count(*) FROM match_tiebreaker_lineups l
                 JOIN match_tiebreakers t ON t.id = l.tiebreaker_id WHERE t.match_id=$1)::int AS lineups`,
      [tie.match],
    );
    expect(counts[0]).toEqual({ tb: 1, lineups: 2 });
    expect(await executeSql(pickRow, [tie.homeTeam])).toEqual(chosen);
    expect(await tie.matchLineupRows()).toBe(before);
  });
});
