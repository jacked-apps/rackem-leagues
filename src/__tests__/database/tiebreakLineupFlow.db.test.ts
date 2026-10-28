// @vitest-environment jsdom
/**
 * @fileoverview DB round-trip for the tiebreak lineup writes — Unit 3 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * Walks the whole lineup-page tiebreak flow through the real writers
 * (setTiebreakSlot / lockTiebreakLineup / unlockTiebreakLineup) and pins:
 *   - picks land on the TIEBREAK lineup only
 *   - a double-duty player (same member in two match slots) can fill two
 *     tiebreak slots — Ed: that person plays twice in the tiebreaker too
 *   - locking copies the order onto the tiebreak game rows (scoring reads who
 *     shoots from them), then stamps the tiebreak lineup's own locked_at
 *   - THE MATCH LINEUP IS BYTE-IDENTICAL across the entire flow — the plan's
 *     chosen mitigation for "a branch still writes match_lineups" (it fires
 *     whichever branch leaked)
 *
 * Run: `pnpm test:run src/__tests__/database/tiebreakLineupFlow`
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { createTiebreakerRecord } from '@/api/mutations/tiebreakers';
import { setTiebreakSlot, lockTiebreakLineup, unlockTiebreakLineup } from '@/api/mutations/tiebreakerLineups';
import { getMatchLineups } from '@/api/queries/matches';
import { createTieFixture, type TieFixture } from './helpers/tieFixture';

let tie: TieFixture;
let before = '';
let homeTbLineup = '';
let games: { id: string; game_number: number }[] = [];

beforeAll(async () => {
  // Home: John (a) plays double duty in slots 1 and 3; Sara (b) in slot 2.
  tie = await createTieFixture(['a', 'b', 'a']);
  before = await tie.matchLineupRows();

  const { homeLineup, awayLineup } = await getMatchLineups(tie.match, tie.homeTeam, tie.awayTeam, false);
  const tbId = await createTiebreakerRecord({
    matchId: tie.match,
    gameType: 'eight_ball',
    shape: { gamesNeeded: 2, gameCount: 3, playersPerSide: 3 },
    homeLineup: homeLineup!,
    awayLineup: awayLineup!,
  });
  homeTbLineup = (await executeSql(
    `SELECT id FROM match_tiebreaker_lineups WHERE tiebreaker_id=$1 AND team_id=$2`, [tbId, tie.homeTeam],
  ))[0].id;
  games = await executeSql(
    `INSERT INTO match_games (match_id, game_number, home_action, away_action, is_tiebreaker, game_type)
     VALUES ($1,19,'breaks','racks',true,'eight_ball'), ($1,20,'racks','breaks',true,'eight_ball'),
            ($1,21,'breaks','racks',true,'eight_ball')
     RETURNING id, game_number`,
    [tie.match],
  );
});

afterAll(async () => {
  await tie?.cleanup();
  await closePostgresPool();
});

const [john, sara] = [() => tie.homeSlots[0], () => tie.homeSlots[1]];

describe('tiebreak lineup flow', () => {
  it('reorders onto the tiebreak lineup, with double duty filling two slots', async () => {
    // New order: Sara, John, John (handicaps copied: Sara -0 → 0, John → -1).
    await setTiebreakSlot(homeTbLineup, 1, sara(), 0);
    await setTiebreakSlot(homeTbLineup, 2, john(), -1);
    await setTiebreakSlot(homeTbLineup, 3, john(), -1);

    const row = (await executeSql(`SELECT * FROM match_tiebreaker_lineups WHERE id=$1`, [homeTbLineup]))[0];
    expect([row.player1_id, row.player2_id, row.player3_id]).toEqual([sara(), john(), john()]);
    expect(await tie.matchLineupRows()).toBe(before);
  });

  it('lock copies the order onto the tiebreak games, then locks only the tiebreak lineup', async () => {
    await lockTiebreakLineup({
      lineupId: homeTbLineup, isHomeTeam: true, order: [sara(), john(), john()], games,
    });

    const shooters = await executeSql(
      `SELECT game_number, home_player_id FROM match_games
        WHERE match_id=$1 AND is_tiebreaker ORDER BY game_number`, [tie.match]);
    expect(shooters.map((g: { home_player_id: string }) => g.home_player_id)).toEqual([sara(), john(), john()]);

    const row = (await executeSql(`SELECT locked, locked_at FROM match_tiebreaker_lineups WHERE id=$1`, [homeTbLineup]))[0];
    expect(row.locked).toBe(true);
    expect(row.locked_at).not.toBeNull();
    expect(await tie.matchLineupRows()).toBe(before);
  });

  it('unlock reopens the tiebreak lineup and still never touches the match lineup', async () => {
    await unlockTiebreakLineup(homeTbLineup);
    const row = (await executeSql(`SELECT locked, locked_at FROM match_tiebreaker_lineups WHERE id=$1`, [homeTbLineup]))[0];
    expect(row).toEqual({ locked: false, locked_at: null });
    expect(await tie.matchLineupRows()).toBe(before);
  });
});
