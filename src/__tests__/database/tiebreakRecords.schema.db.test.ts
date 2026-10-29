/**
 * @fileoverview Schema checks for the tiebreak record (match_tiebreakers +
 * match_tiebreaker_lineups) — Unit 1 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * The record is a parallel mini-match beside the real one (requirement D0), so
 * these tests pin the guarantees the later units lean on: one tiebreaker per
 * match, it disappears with its match, its shape numbers are sane, and both
 * tables reach the other captain's phone through realtime.
 *
 * Every test runs inside a transaction that is ROLLED BACK, so nothing is left
 * in the local database. Raw pg (no supabase-js writes → no jsdom pragma).
 *
 * Run: `pnpm test:run src/__tests__/database/tiebreakRecords`
 * Requires: local Supabase with 20261028194312_tiebreak_records applied.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';

let db: PoolClient;
let matchId: string;
let homeTeamId: string;
let memberId: string;

/** Run one INSERT ... RETURNING id and hand back the id. */
async function id(sql: string, params: unknown[] = []): Promise<string> {
  return (await db.query<{ id: string }>(sql, params)).rows[0].id;
}

/** Insert a best-of-3 tiebreaker for the fixture match. */
function insertTiebreaker(gamesNeeded = 2, gameCount = 3): Promise<string> {
  return id(
    `INSERT INTO match_tiebreakers (match_id, games_needed, game_count, players_per_side, game_type)
     VALUES ($1, $2, $3, 3, 'eight_ball') RETURNING id`,
    [matchId, gamesNeeded, gameCount],
  );
}

beforeEach(async () => {
  db = await getPostgresPool().connect();
  await db.query('BEGIN');
  // Minimal org → league → season → week → two teams → one match.
  memberId = (await db.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 1')).rows[0].id;
  const orgId = await id(
    `INSERT INTO organizations (organization_name, organization_address, organization_city,
       organization_state, organization_zip_code, organization_email, organization_phone,
       stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
       billing_zip, created_by)
     VALUES ('TbOrg','1 St','City','ST','00000','o@e.com','555','cus','pm','4242','visa',
       12, 2030, '00000', $1) RETURNING id`,
    [memberId],
  );
  const leagueId = await id(
    `INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
     VALUES ($1, 'eight_ball', 'monday', '2026-01-01') RETURNING id`,
    [orgId],
  );
  const seasonId = await id(
    `INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
     VALUES ($1, 'S1', '2026-01-01', '2026-12-01', 12) RETURNING id`,
    [leagueId],
  );
  const weekId = await id(
    `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
     VALUES ($1, '2026-02-02', 'W1', 'regular') RETURNING id`,
    [seasonId],
  );
  const team = (name: string) =>
    id(
      `INSERT INTO teams (season_id, league_id, team_name, roster_size, status)
       VALUES ($1, $2, $3, 5, 'active') RETURNING id`,
      [seasonId, leagueId, name],
    );
  homeTeamId = await team('Home');
  const awayTeamId = await team('Away');
  matchId = await id(
    `INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id)
     VALUES ($1, $2, 1, $3, $4) RETURNING id`,
    [seasonId, weekId, homeTeamId, awayTeamId],
  );
});

afterEach(async () => {
  await db.query('ROLLBACK');
  db.release();
});

afterAll(async () => {
  await closePostgresPool();
});

describe('tiebreak record schema', () => {
  it('stores a tiebreaker and a lineup, and reads them back', async () => {
    const tbId = await insertTiebreaker();
    await db.query(
      `INSERT INTO match_tiebreaker_lineups (tiebreaker_id, team_id, player1_id, player1_handicap)
       VALUES ($1, $2, $3, 1.0)`,
      [tbId, homeTeamId, memberId],
    );
    const { rows } = await db.query(
      `SELECT t.games_needed, t.game_count, t.winning_team_id, l.player1_id, l.locked
         FROM match_tiebreakers t JOIN match_tiebreaker_lineups l ON l.tiebreaker_id = t.id
        WHERE t.id = $1`,
      [tbId],
    );
    expect(rows).toEqual([
      { games_needed: 2, game_count: 3, winning_team_id: null, player1_id: memberId, locked: false },
    ]);
  });

  it('rejects a second tiebreaker for the same match', async () => {
    await insertTiebreaker();
    await expect(insertTiebreaker()).rejects.toThrow(/duplicate key/);
  });

  it('rejects a tiebreaker needing more wins than it has games', async () => {
    await expect(insertTiebreaker(4, 3)).rejects.toThrow(/check constraint/);
  });

  it('goes away with its match, lineups included', async () => {
    const tbId = await insertTiebreaker();
    await db.query(
      `INSERT INTO match_tiebreaker_lineups (tiebreaker_id, team_id) VALUES ($1, $2)`,
      [tbId, homeTeamId],
    );
    await db.query('DELETE FROM matches WHERE id = $1', [matchId]);
    const left = await db.query(
      `SELECT (SELECT count(*) FROM match_tiebreakers WHERE id = $1)::int AS tb,
              (SELECT count(*) FROM match_tiebreaker_lineups WHERE tiebreaker_id = $1)::int AS lineups`,
      [tbId],
    );
    expect(left.rows[0]).toEqual({ tb: 0, lineups: 0 });
  });

  it('is published to realtime so both captains see picks', async () => {
    const { rows } = await db.query(
      `SELECT tablename FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename LIKE 'match_tiebreaker%'
        ORDER BY tablename`,
    );
    expect(rows.map((r) => r.tablename)).toEqual(['match_tiebreaker_lineups', 'match_tiebreakers']);
  });
});
