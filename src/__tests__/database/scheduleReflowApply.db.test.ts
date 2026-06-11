// @vitest-environment jsdom
/**
 * @fileoverview DB round-trip integration test for the blackout re-flow apply layer
 * (Unit 2). Proves against the real local Postgres that adding/removing a blackout:
 *
 *  - inserts/deletes the blackout skip row on the targeted night,
 *  - re-dates the PLAY weeks (regular + playoffs) around fixed skips, preserving the
 *    play-week count and respecting UNIQUE(season_id, scheduled_date) with no violation,
 *  - leaves EVERY match's `season_week_id` binding untouched (the load-bearing
 *    guarantee — matches never move, so the old stranded-games bug cannot recur),
 *  - moves `seasons.end_date` to the new last play night.
 *
 * A single season is round-tripped add → remove to prove both directions and that the
 * schedule returns to its original shape with bindings intact throughout.
 *
 * Isolated, unique-id fixture; cleaned up afterward (db project runs sequentially on
 * one shared Postgres).
 *
 * @see docs/plans/2026-06-11-001-fix-edit-page-blackout-reflow-plan.md — Unit 2
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { executeSql } from '@/test/dbTestUtils';
import { applyBlackoutReflow } from '@/utils/scheduleReflowApply';

const ids = {
  member: randomUUID(),
  org: randomUUID(),
  league: randomUUID(),
  season: randomUUID(),
  w1: randomUUID(),
  w2: randomUUID(),
  w3: randomUUID(),
  wBreak: randomUUID(),
  wPlayoff: randomUUID(),
  m1: randomUUID(),
  m2: randomUUID(),
  m3: randomUUID(),
  mPlayoff: randomUUID(),
};

/** Read the schedule as `[date, type]` pairs, dates normalized to YYYY-MM-DD. */
async function readWeeks(): Promise<Array<{ date: string; type: string }>> {
  const rows = await executeSql(
    `SELECT to_char(scheduled_date,'YYYY-MM-DD') AS date, week_type AS type
       FROM season_weeks WHERE season_id=$1 ORDER BY scheduled_date`,
    [ids.season],
  );
  return rows as Array<{ date: string; type: string }>;
}

/** Read each match's week binding, keyed by match id. */
async function readBindings(): Promise<Record<string, string>> {
  const rows = (await executeSql(
    `SELECT id, season_week_id FROM matches WHERE season_id=$1 ORDER BY id`,
    [ids.season],
  )) as Array<{ id: string; season_week_id: string }>;
  return Object.fromEntries(rows.map((r) => [r.id, r.season_week_id]));
}

async function seasonEndDate(): Promise<string> {
  const rows = (await executeSql(
    `SELECT to_char(end_date,'YYYY-MM-DD') AS end_date FROM seasons WHERE id=$1`,
    [ids.season],
  )) as Array<{ end_date: string }>;
  return rows[0].end_date;
}

let originalBindings: Record<string, string>;

beforeAll(async () => {
  await executeSql(
    `INSERT INTO members (id, first_name, last_name, city, state) VALUES ($1,'Reflow','Tester','Town','ST')`,
    [ids.member],
  );
  await executeSql(
    `INSERT INTO organizations (id, created_by, organization_name, organization_address,
        organization_city, organization_state, organization_zip_code, organization_email,
        organization_phone, stripe_customer_id, payment_method_id, card_last4, card_brand,
        expiry_month, expiry_year, billing_zip)
     VALUES ($1,$2,'Reflow Org','1 St','Town','ST','00000','o@test.com','555','cus','pm','4242','visa',1,2030,'00000')`,
    [ids.org, ids.member],
  );
  await executeSql(
    `INSERT INTO leagues (id, organization_id, game_type, day_of_week, league_start_date)
     VALUES ($1,$2,'eight_ball','wednesday','2026-07-01')`,
    [ids.league, ids.org],
  );
  // 3 regular + season-end break + playoff, Wednesdays; end on the playoff night.
  // season_length (10) is metadata only and unread by the re-flow — the actual
  // week rows below define the schedule; the column just has a 10..52 CHECK.
  await executeSql(
    `INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length)
     VALUES ($1,$2,'Reflow Season','2026-07-01','2026-07-29',10)`,
    [ids.season, ids.league],
  );
  const weekRows: Array<[string, string, string, string]> = [
    [ids.w1, '2026-07-01', 'Week 1', 'regular'],
    [ids.w2, '2026-07-08', 'Week 2', 'regular'],
    [ids.w3, '2026-07-15', 'Week 3', 'regular'],
    [ids.wBreak, '2026-07-22', 'Season End Break', 'season_end_break'],
    [ids.wPlayoff, '2026-07-29', 'Playoffs', 'playoffs'],
  ];
  for (const [id, date, name, type] of weekRows) {
    await executeSql(
      `INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, ids.season, date, name, type],
    );
  }
  // One match bound to each play week (3 regular + playoff placeholder).
  const matchRows: Array<[string, string]> = [
    [ids.m1, ids.w1],
    [ids.m2, ids.w2],
    [ids.m3, ids.w3],
    [ids.mPlayoff, ids.wPlayoff],
  ];
  for (const [mid, weekId] of matchRows) {
    await executeSql(
      `INSERT INTO matches (id, season_id, season_week_id, match_number, status)
       VALUES ($1,$2,$3,1,'scheduled')`,
      [mid, ids.season, weekId],
    );
  }
  originalBindings = await readBindings();
});

afterAll(async () => {
  await executeSql(`DELETE FROM matches WHERE season_id=$1`, [ids.season]);
  await executeSql(`DELETE FROM season_weeks WHERE season_id=$1`, [ids.season]);
  await executeSql(`DELETE FROM seasons WHERE id=$1`, [ids.season]);
  await executeSql(`DELETE FROM leagues WHERE id=$1`, [ids.league]);
  await executeSql(`DELETE FROM organizations WHERE id=$1`, [ids.org]);
  await executeSql(`DELETE FROM members WHERE id=$1`, [ids.member]);
});

describe('applyBlackoutReflow — DB round-trip', () => {
  it('add: inserts a blackout, slides play weeks out, keeps every match binding', async () => {
    const result = await applyBlackoutReflow(ids.season, {
      kind: 'add',
      date: '2026-07-08',
      reason: 'Holiday',
      skipType: 'blackout',
    });
    expect(result.success).toBe(true);
    expect(result.newSeasonEndDate).toBe('2026-08-05');

    // Schedule: blackout now on 7/08; Week 2/3/Playoff slid out; break fixed at 7/22.
    expect(await readWeeks()).toEqual([
      { date: '2026-07-01', type: 'regular' }, // Week 1 unchanged
      { date: '2026-07-08', type: 'blackout' }, // new skip
      { date: '2026-07-15', type: 'regular' }, // Week 2
      { date: '2026-07-22', type: 'season_end_break' }, // fixed skip
      { date: '2026-07-29', type: 'regular' }, // Week 3 (flowed around the break)
      { date: '2026-08-05', type: 'playoffs' }, // Playoffs
    ]);

    // Play-week count preserved (3 regular + 1 playoff still = 4 matches' worth).
    const playCount = (await readWeeks()).filter(
      (w) => w.type === 'regular' || w.type === 'playoffs',
    ).length;
    expect(playCount).toBe(4);

    // THE invariant: every match still points at its original week row.
    expect(await readBindings()).toEqual(originalBindings);

    // Season tail extended.
    expect(await seasonEndDate()).toBe('2026-08-05');
  });

  it('remove: deletes the blackout, pulls the schedule back, bindings still intact', async () => {
    const result = await applyBlackoutReflow(ids.season, {
      kind: 'remove',
      date: '2026-07-08',
    });
    expect(result.success).toBe(true);
    expect(result.newSeasonEndDate).toBe('2026-07-29');

    // Back to the original five-row shape.
    expect(await readWeeks()).toEqual([
      { date: '2026-07-01', type: 'regular' },
      { date: '2026-07-08', type: 'regular' },
      { date: '2026-07-15', type: 'regular' },
      { date: '2026-07-22', type: 'season_end_break' },
      { date: '2026-07-29', type: 'playoffs' },
    ]);

    // Bindings unchanged across the whole round-trip.
    expect(await readBindings()).toEqual(originalBindings);
    expect(await seasonEndDate()).toBe('2026-07-29');
  });

  it('rejects an invalid action without mutating the schedule', async () => {
    const before = await readWeeks();
    // 7/22 is the season-end break — not a play week, so it cannot be blacked out.
    const result = await applyBlackoutReflow(ids.season, {
      kind: 'add',
      date: '2026-07-22',
      reason: 'nope',
      skipType: 'blackout',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a play week/i);
    expect(await readWeeks()).toEqual(before);
  });
});
