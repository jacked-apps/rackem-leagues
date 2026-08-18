// @vitest-environment jsdom
/**
 * @fileoverview DB integration test for the schedule-decouple migration (Phase B1).
 *
 * Verifies the durable schema effect of migration
 * 20260621000000_schedule_decouple_labels_and_types.sql against local Postgres:
 *  - the week_type CHECK now accepts regular / blackout / playoffs;
 *  - it REJECTS the dropped season_end_break type;
 *  - a blackout stores its display label in `notes` (the derived-label model
 *    reads a blackout's label from there).
 *
 * The one-time backfill/collapse of existing rows is exercised + characterised
 * directly against the cloned data when the migration is applied; this test
 * guards the lasting constraint so a future schema regression fails loudly.
 *
 * @see docs/plans/2026-06-14-001-refactor-schedule-matchup-decoupling-plan.md — B1
 */
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { executeSql } from '@/test/dbTestUtils';

const created = { seasons: [] as string[], leagues: [] as string[], orgs: [] as string[], members: [] as string[] };

async function makeMember(): Promise<string> {
  const id = randomUUID();
  await executeSql(`INSERT INTO members (id, first_name, last_name, city, state) VALUES ($1,'Dec','Tester','Town','ST')`, [id]);
  created.members.push(id);
  return id;
}

/** Minimal org → league → season chain so season_weeks inserts satisfy the FK. */
async function makeSeason(): Promise<string> {
  const orgId = randomUUID(), leagueId = randomUUID(), seasonId = randomUUID();
  const creator = await makeMember();
  await executeSql(
    `INSERT INTO organizations (id, created_by, organization_name, organization_address, organization_city,
       organization_state, organization_zip_code, organization_email, organization_phone, stripe_customer_id,
       payment_method_id, card_last4, card_brand, expiry_month, expiry_year, billing_zip)
     VALUES ($1,$2,'Dec Org','1 St','Town','ST','00000','o@test.com','555','cus','pm','4242','visa',1,2030,'00000')`,
    [orgId, creator],
  );
  created.orgs.push(orgId);
  await executeSql(`INSERT INTO leagues (id, organization_id, game_type, day_of_week, league_start_date) VALUES ($1,$2,'eight_ball','wednesday','2026-07-01')`, [leagueId, orgId]);
  created.leagues.push(leagueId);
  await executeSql(`INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length) VALUES ($1,$2,'Dec Season','2026-07-01','2026-10-01',12)`, [seasonId, leagueId]);
  created.seasons.push(seasonId);
  return seasonId;
}

afterAll(async () => {
  for (const s of created.seasons) {
    await executeSql(`DELETE FROM season_weeks WHERE season_id=$1`, [s]);
    await executeSql(`DELETE FROM seasons WHERE id=$1`, [s]);
  }
  for (const l of created.leagues) await executeSql(`DELETE FROM leagues WHERE id=$1`, [l]);
  for (const o of created.orgs) await executeSql(`DELETE FROM organizations WHERE id=$1`, [o]);
  for (const m of created.members) await executeSql(`DELETE FROM members WHERE id=$1`, [m]);
});

describe('schedule decouple migration — week_type CHECK + notes label', () => {
  it('accepts regular / blackout / playoffs', async () => {
    const seasonId = await makeSeason();
    for (const [i, type] of (['regular', 'blackout', 'playoffs'] as const).entries()) {
      await expect(
        executeSql(
          `INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type) VALUES ($1,$2,$3,$4,$5)`,
          [randomUUID(), seasonId, `2026-07-0${i + 1}`, 'x', type],
        ),
      ).resolves.toBeDefined();
    }
  });

  it('REJECTS the dropped season_end_break type', async () => {
    const seasonId = await makeSeason();
    await expect(
      executeSql(
        `INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type) VALUES ($1,$2,'2026-07-15','x','season_end_break')`,
        [randomUUID(), seasonId],
      ),
    ).rejects.toThrow();
  });

  it('stores a blackout label in notes', async () => {
    const seasonId = await makeSeason();
    const weekId = randomUUID();
    await executeSql(
      `INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type, notes) VALUES ($1,$2,'2026-07-04','Independence Day','blackout','Independence Day')`,
      [weekId, seasonId],
    );
    const rows = (await executeSql(`SELECT notes FROM season_weeks WHERE id=$1`, [weekId])) as Array<{ notes: string }>;
    expect(rows[0].notes).toBe('Independence Day');
  });
});
