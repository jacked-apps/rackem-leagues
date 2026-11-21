// @vitest-environment jsdom
/**
 * @fileoverview DB test for clearSchedule: wipes a season's matches AND its
 * BYE team, so regenerating at an odd team count makes exactly one fresh BYE
 * (a leftover BYE used to become a second one and break team drops). Real
 * teams stay; another season's BYE must be left alone.
 *
 * Run: `pnpm test:run src/__tests__/database/clearSchedule`
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';
import { clearSchedule } from '@/utils/scheduleGenerator';

describe('clearSchedule', () => {
  let pool: Pool;
  const orgIds: string[] = [];

  beforeAll(() => { pool = getPostgresPool(); });
  afterAll(async () => { await closePostgresPool(); });
  afterEach(async () => {
    for (const orgId of orgIds.splice(0)) {
      const seasonFilter = `season_id IN (SELECT s.id FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = $1)`;
      await pool.query(`DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE ${seasonFilter})`, [orgId]);
      for (const t of ['matches', 'teams', 'season_weeks']) await pool.query(`DELETE FROM ${t} WHERE ${seasonFilter}`, [orgId]);
      await pool.query(`DELETE FROM seasons WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = $1)`, [orgId]);
      await pool.query(`DELETE FROM leagues WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    }
  });

  const one = async (sql: string, params: unknown[]) => (await pool.query<{ id: string }>(sql, params)).rows[0].id;
  const count = async (sql: string, params: unknown[]) => (await pool.query<{ n: number }>(sql, params)).rows[0].n;

  async function seasonWithBye(leagueId: string, member: string) {
    const seasonId = await one(`INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
       VALUES ($1,'S','2026-01-01','2026-12-01',12) RETURNING id`, [leagueId]);
    const weekId = await one(`INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1,'2026-02-01','W','regular') RETURNING id`, [seasonId]);
    const team = (name: string, status: string) =>
      one(`INSERT INTO teams (season_id, league_id, team_name, roster_size, status, captain_id)
           VALUES ($1,$2,$3,5,$4,$5) RETURNING id`, [seasonId, leagueId, name, status, status === 'bye' ? null : member]);
    const a = await team('A', 'active');
    const b = await team('B', 'active');
    const c = await team('C', 'active');
    const bye = await team('BYE', 'bye');
    for (const [n, h, w] of [[1, a, b], [2, c, bye]] as const) {
      await pool.query(`INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status)
         VALUES ($1,$2,$3,$4,$5,'scheduled')`, [seasonId, weekId, n, h, w]);
    }
    return { seasonId, bye };
  }

  it("removes the season's matches and its BYE, keeps its real teams, and leaves other seasons alone", async () => {
    const member = (await pool.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 1')).rows[0].id;
    const orgId = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('ClearOrg','1 St','City','ST','00000','o@e.com','555','c','p','4242','visa',12,2030,'00000',$1) RETURNING id`,
      [member]);
    orgIds.push(orgId);
    const leagueId = await one(`INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
       VALUES ($1,'eight_ball','monday','2026-01-01') RETURNING id`, [orgId]);
    const target = await seasonWithBye(leagueId, member);
    const other = await seasonWithBye(leagueId, member);

    const result = await clearSchedule(target.seasonId);

    expect(result).toEqual({ success: true, matchesDeleted: 2 });
    expect(await count('SELECT count(*)::int AS n FROM matches WHERE season_id = $1', [target.seasonId])).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM teams WHERE season_id = $1 AND status = 'bye'`, [target.seasonId])).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM teams WHERE season_id = $1 AND status = 'active'`, [target.seasonId])).toBe(3);
    // The other season is untouched: its BYE and matches remain.
    expect(await count('SELECT count(*)::int AS n FROM teams WHERE id = $1', [other.bye])).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM matches WHERE season_id = $1', [other.seasonId])).toBe(2);
  });
});
