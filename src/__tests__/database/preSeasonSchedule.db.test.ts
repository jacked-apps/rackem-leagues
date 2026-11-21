// @vitest-environment jsdom
/**
 * @fileoverview DB test for preSeasonSchedule (Ed's "perfect schedule" rule):
 * fetchSeasonScheduleState says whether a season has a schedule and whether
 * play has begun (a played match in ANOTHER season must not count), and
 * removeTeamAndClearSchedule deletes the team plus the whole schedule and BYE
 * while the other teams stay.
 *
 * Run: `pnpm test:run src/__tests__/database/preSeasonSchedule`
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';
import { fetchSeasonScheduleState, removeTeamAndClearSchedule } from '@/operator/team-management/preSeasonSchedule';

describe('preSeasonSchedule', () => {
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

  async function league() {
    const member = (await pool.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 1')).rows[0].id;
    const orgId = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('PreSeasonOrg','1 St','City','ST','00000','o@e.com','555','c','p','4242','visa',12,2030,'00000',$1) RETURNING id`,
      [member]);
    orgIds.push(orgId);
    const leagueId = await one(`INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
       VALUES ($1,'eight_ball','monday','2026-01-01') RETURNING id`, [orgId]);
    /** A season with teams A, B, C + BYE and one week: A-B, C-BYE. */
    const season = async (firstMatchStatus = 'scheduled') => {
      const seasonId = await one(`INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
         VALUES ($1,'S','2026-01-01','2026-12-01',12) RETURNING id`, [leagueId]);
      const weekId = await one(`INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
         VALUES ($1,'2026-02-01','W','regular') RETURNING id`, [seasonId]);
      const team = (name: string, status = 'active') =>
        one(`INSERT INTO teams (season_id, league_id, team_name, roster_size, status, captain_id)
             VALUES ($1,$2,$3,5,$4,$5) RETURNING id`, [seasonId, leagueId, name, status, status === 'bye' ? null : member]);
      const a = await team('A');
      const b = await team('B');
      const c = await team('C');
      const bye = await team('BYE', 'bye');
      await pool.query(`INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status)
         VALUES ($1,$2,1,$3,$4,$5), ($1,$2,2,$6,$7,'scheduled')`, [seasonId, weekId, a, b, firstMatchStatus, c, bye]);
      return { seasonId, a, b, c, bye };
    };
    return { leagueId, season };
  }

  it('reports schedule + started per season, ignoring other seasons', async () => {
    const { leagueId, season } = await league();
    const fresh = await season();
    await season('completed'); // another season already under way
    const empty = await one(`INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
       VALUES ($1,'S','2026-01-01','2026-12-01',12) RETURNING id`, [leagueId]);

    expect(await fetchSeasonScheduleState(fresh.seasonId)).toEqual({ hasSchedule: true, started: false });
    expect(await fetchSeasonScheduleState(empty)).toEqual({ hasSchedule: false, started: false });
    await pool.query(`UPDATE matches SET winner_team_id = $1 WHERE season_id = $2 AND match_number = 2`, [fresh.c, fresh.seasonId]);
    expect(await fetchSeasonScheduleState(fresh.seasonId)).toEqual({ hasSchedule: true, started: true }); // a settled bye counts
  });

  it('removes the team, the whole schedule and the BYE; the other teams stay', async () => {
    const { season } = await league();
    const s = await season();

    await removeTeamAndClearSchedule(s.a, s.seasonId);

    expect(await count('SELECT count(*)::int AS n FROM matches WHERE season_id = $1', [s.seasonId])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM teams WHERE id = ANY($1)', [[s.a, s.bye]])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM teams WHERE id = ANY($1)', [[s.b, s.c]])).toBe(2);
  });
});
