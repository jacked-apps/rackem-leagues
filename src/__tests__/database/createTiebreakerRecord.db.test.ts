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
 *     never overwrites an order a captain already chose
 *
 * jsdom pragma: the mutation writes through supabase-js (see
 * project_happy_dom_supabase_insert_limit). Fixture rows are written with raw
 * SQL and deleted in afterAll.
 *
 * Run: `pnpm test:run src/__tests__/database/createTiebreakerRecord`
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { createTiebreakerRecord } from '@/api/mutations/tiebreakers';
import { getMatchLineups } from '@/api/queries/matches';

const ids = {
  members: [] as string[],
  org: randomUUID(),
  league: randomUUID(),
  season: randomUUID(),
  week: randomUUID(),
  homeTeam: randomUUID(),
  awayTeam: randomUUID(),
  match: randomUUID(),
};
const SHAPE = { gamesNeeded: 2, gameCount: 3, playersPerSide: 3 };

async function makeMember(): Promise<string> {
  const id = randomUUID();
  await executeSql(
    `INSERT INTO members (id, first_name, last_name, city, state) VALUES ($1,'Tb','Player','Town','ST')`,
    [id],
  );
  ids.members.push(id);
  return id;
}

/** Full match_lineups rows as JSON, for a byte-identical comparison. */
async function matchLineupRows(): Promise<string> {
  const rows = await executeSql(
    `SELECT to_jsonb(ml) AS r FROM match_lineups ml WHERE match_id = $1 ORDER BY team_id`,
    [ids.match],
  );
  return JSON.stringify(rows.map((x: { r: unknown }) => x.r));
}

/** Run the mutation the way MatchEndVerification does: seeded from match lineups. */
async function fire(): Promise<string> {
  const { homeLineup, awayLineup } = await getMatchLineups(ids.match, ids.homeTeam, ids.awayTeam, false);
  return createTiebreakerRecord({
    matchId: ids.match,
    gameType: 'eight_ball',
    shape: SHAPE,
    homeLineup: homeLineup!,
    awayLineup: awayLineup!,
  });
}

beforeAll(async () => {
  const lo = await makeMember();
  await executeSql(
    `INSERT INTO organizations (id, created_by, organization_name, organization_address,
        organization_city, organization_state, organization_zip_code, organization_email,
        organization_phone, stripe_customer_id, payment_method_id, card_last4, card_brand,
        expiry_month, expiry_year, billing_zip)
     VALUES ($1,$2,'Tb Org','1 St','Town','ST','00000','o@test.com','555','cus','pm','4242','visa',1,2030,'00000')`,
    [ids.org, lo],
  );
  await executeSql(
    `INSERT INTO leagues (id, organization_id, game_type, day_of_week, league_start_date)
     VALUES ($1,$2,'eight_ball','monday','2026-01-01')`,
    [ids.league, ids.org],
  );
  await executeSql(
    `INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length)
     VALUES ($1,$2,'Tb Season','2026-01-01','2026-06-01',10)`,
    [ids.season, ids.league],
  );
  await executeSql(
    `INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type)
     VALUES ($1,$2,'2026-02-01','Week 1','regular')`,
    [ids.week, ids.season],
  );
  for (const [tid, name] of [[ids.homeTeam, 'Home'], [ids.awayTeam, 'Away']] as const) {
    await executeSql(
      `INSERT INTO teams (id, season_id, league_id, team_name, roster_size) VALUES ($1,$2,$3,$4,5)`,
      [tid, ids.season, ids.league, name],
    );
  }
  // The trigger auto-creates both match lineups on insert.
  await executeSql(
    `INSERT INTO matches (id, season_id, season_week_id, match_number, home_team_id, away_team_id, status, match_result)
     VALUES ($1,$2,$3,1,$4,$5,'in_progress','tie')`,
    [ids.match, ids.season, ids.week, ids.homeTeam, ids.awayTeam],
  );
  // Home fills FOUR slots so we can prove only players_per_side (3) are seeded.
  for (const [team, count] of [[ids.homeTeam, 4], [ids.awayTeam, 3]] as const) {
    const players = [];
    for (let i = 0; i < count; i++) players.push(await makeMember());
    await executeSql(
      `UPDATE match_lineups SET
         player1_id=$2, player1_handicap=1, player2_id=$3, player2_handicap=0,
         player3_id=$4, player3_handicap=-1, player4_id=$5, player4_handicap=$6,
         locked=true
       WHERE match_id=$1 AND team_id=$7`,
      [ids.match, players[0], players[1], players[2], players[3] ?? null, players[3] ? 2 : null, team],
    );
  }
});

afterAll(async () => {
  const del = async (sql: string, p: unknown[] = []) => {
    try { await executeSql(sql, p); } catch { /* best-effort cleanup */ }
  };
  await del(`DELETE FROM match_tiebreakers WHERE match_id=$1`, [ids.match]);
  await del(`DELETE FROM matches WHERE id=$1`, [ids.match]);
  await del(`DELETE FROM teams WHERE id IN ($1,$2)`, [ids.homeTeam, ids.awayTeam]);
  await del(`DELETE FROM season_weeks WHERE id=$1`, [ids.week]);
  await del(`DELETE FROM seasons WHERE id=$1`, [ids.season]);
  await del(`DELETE FROM leagues WHERE id=$1`, [ids.league]);
  await del(`DELETE FROM organizations WHERE id=$1`, [ids.org]);
  await del(`DELETE FROM members WHERE id = ANY($1::uuid[])`, [ids.members]);
  await closePostgresPool();
});

describe('createTiebreakerRecord', () => {
  let before = '';

  it('creates one tiebreaker and two lineups, seeded from the match lineups', async () => {
    before = await matchLineupRows();
    const tbId = await fire();

    const tb = await executeSql(`SELECT * FROM match_tiebreakers WHERE match_id=$1`, [ids.match]);
    expect(tb).toHaveLength(1);
    expect(tb[0]).toMatchObject({ id: tbId, games_needed: 2, game_count: 3, players_per_side: 3 });

    const home = (await executeSql(
      `SELECT t.player1_id, t.player3_id, t.player3_handicap, t.player4_id, t.locked,
              m.player1_id AS m1, m.player3_id AS m3
         FROM match_tiebreaker_lineups t
         JOIN match_lineups m ON m.team_id = t.team_id AND m.match_id = $1
        WHERE t.tiebreaker_id = $2 AND t.team_id = $3`,
      [ids.match, tbId, ids.homeTeam],
    ))[0];
    expect(home.player1_id).toBe(home.m1);
    expect(home.player3_id).toBe(home.m3);
    expect(Number(home.player3_handicap)).toBe(-1);
    // Slot 4 played the match but is beyond players_per_side → not seeded.
    expect(home.player4_id).toBeNull();
    expect(home.locked).toBe(false);
  });

  it('leaves the match lineups byte-identical — still locked, same locked_at', async () => {
    expect(await matchLineupRows()).toBe(before);
    const locks = await executeSql(
      `SELECT locked, locked_at FROM match_lineups WHERE match_id=$1`,
      [ids.match],
    );
    expect(locks.every((l: { locked: boolean; locked_at: string | null }) => l.locked && l.locked_at)).toBe(true);
  });

  it('re-firing creates nothing and keeps a captain’s chosen order', async () => {
    // A captain reorders: swap slots 1 and 2 on the home tiebreak lineup.
    await executeSql(
      `UPDATE match_tiebreaker_lineups
          SET player1_id = player2_id, player2_id = player1_id
        WHERE team_id = $1`,
      [ids.homeTeam],
    );
    const chosen = await executeSql(
      `SELECT to_jsonb(t) - 'updated_at' AS r FROM match_tiebreaker_lineups t WHERE team_id=$1`,
      [ids.homeTeam],
    );

    await fire();
    await fire();

    const counts = await executeSql(
      `SELECT (SELECT count(*) FROM match_tiebreakers WHERE match_id=$1)::int AS tb,
              (SELECT count(*) FROM match_tiebreaker_lineups l
                 JOIN match_tiebreakers t ON t.id = l.tiebreaker_id
                WHERE t.match_id=$1)::int AS lineups`,
      [ids.match],
    );
    expect(counts[0]).toEqual({ tb: 1, lineups: 2 });
    const after = await executeSql(
      `SELECT to_jsonb(t) - 'updated_at' AS r FROM match_tiebreaker_lineups t WHERE team_id=$1`,
      [ids.homeTeam],
    );
    expect(after).toEqual(chosen);
    expect(await matchLineupRows()).toBe(before);
  });
});
