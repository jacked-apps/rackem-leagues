// @vitest-environment jsdom
/**
 * @fileoverview DB integration test for applying a season-length change (Unit 3).
 *
 * Seeds real seasons via `generateSchedule` (so positions + matches exist), then proves
 * against local Postgres:
 *  - lengthen appends correctly-paired weeks (rotation continues), leaves EVERY existing
 *    match byte-identical, places new regular weeks BEFORE the break/playoff, and pushes
 *    break/playoff out;
 *  - lengthen freezes the chart to the stored positions even after a team withdraws;
 *  - shorten trims the tail and pulls break/playoff in;
 *  - shorten REFUSES when a removed week has a played match (sacred data);
 *  - a pre-column season (null positions) can't lengthen.
 *
 * @see docs/plans/2026-06-11-002-feat-change-season-length-plan.md — Unit 3
 */
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { executeSql } from '@/test/dbTestUtils';
import { generateSchedule } from '@/utils/scheduleGenerator';
import { applySeasonLengthChange } from '@/utils/applySeasonLengthChange';
import type { TeamWithPosition } from '@/types/schedule';

const created = { seasons: [] as string[], leagues: [] as string[], orgs: [] as string[], members: [] as string[] };

function wed(i: number): string {
  const d = new Date(2026, 6, 1 + i * 7); // 2026-07-01 + i weeks
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function makeMember(): Promise<string> {
  const id = randomUUID();
  await executeSql(`INSERT INTO members (id, first_name, last_name, city, state) VALUES ($1,'Len','Tester','Town','ST')`, [id]);
  created.members.push(id);
  return id;
}

/** Seed org/league/season + `regularWeeks` regular weeks + break + playoff + teams, then generate matchups. */
async function buildSeason(realTeamCount: number, regularWeeks: number): Promise<{ seasonId: string; teamIds: string[] }> {
  const orgId = randomUUID(), leagueId = randomUUID(), seasonId = randomUUID();
  const creator = await makeMember();
  await executeSql(
    `INSERT INTO organizations (id, created_by, organization_name, organization_address, organization_city,
       organization_state, organization_zip_code, organization_email, organization_phone, stripe_customer_id,
       payment_method_id, card_last4, card_brand, expiry_month, expiry_year, billing_zip)
     VALUES ($1,$2,'Len Org','1 St','Town','ST','00000','o@test.com','555','cus','pm','4242','visa',1,2030,'00000')`,
    [orgId, creator],
  );
  created.orgs.push(orgId);
  await executeSql(`INSERT INTO leagues (id, organization_id, game_type, day_of_week, league_start_date) VALUES ($1,$2,'eight_ball','wednesday','2026-07-01')`, [leagueId, orgId]);
  created.leagues.push(leagueId);
  await executeSql(`INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length) VALUES ($1,$2,'Len Season',$3,$4,$5)`,
    [seasonId, leagueId, wed(0), wed(regularWeeks + 1), regularWeeks]);
  created.seasons.push(seasonId);

  for (let i = 0; i < regularWeeks; i++) {
    await executeSql(`INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type) VALUES ($1,$2,$3,$4,'regular')`,
      [randomUUID(), seasonId, wed(i), `Week ${i + 1}`]);
  }
  await executeSql(`INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type) VALUES ($1,$2,$3,'Season End Break','season_end_break')`, [randomUUID(), seasonId, wed(regularWeeks)]);
  await executeSql(`INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type) VALUES ($1,$2,$3,'Playoffs','playoffs')`, [randomUUID(), seasonId, wed(regularWeeks + 1)]);

  const teamIds: string[] = [];
  for (let i = 0; i < realTeamCount; i++) {
    const teamId = randomUUID();
    const captain = await makeMember();
    await executeSql(`INSERT INTO teams (id, season_id, league_id, captain_id, team_name, roster_size) VALUES ($1,$2,$3,$4,$5,5)`, [teamId, seasonId, leagueId, captain, `Team ${i + 1}`]);
    teamIds.push(teamId);
  }

  const positions: TeamWithPosition[] = teamIds.map((id, i) => ({ id, team_name: `T${i}`, home_venue_id: null, schedule_position: i + 1 }));
  if (realTeamCount % 2 === 1) positions.push({ id: 'BYE', team_name: 'BYE', home_venue_id: null, schedule_position: realTeamCount + 1 });
  const gen = await generateSchedule({ seasonId, teams: positions, skipExistingCheck: true });
  expect(gen.success).toBe(true);
  return { seasonId, teamIds };
}

async function readWeeks(seasonId: string) {
  return (await executeSql(
    `SELECT id, to_char(scheduled_date,'YYYY-MM-DD') AS date, week_type AS type, week_name AS name
       FROM season_weeks WHERE season_id=$1 ORDER BY scheduled_date`, [seasonId],
  )) as Array<{ id: string; date: string; type: string; name: string }>;
}
async function readMatches(seasonId: string) {
  return (await executeSql(
    `SELECT id, season_week_id, home_team_id, away_team_id, match_number, status
       FROM matches WHERE season_id=$1 ORDER BY id`, [seasonId],
  )) as Array<Record<string, unknown>>;
}
async function pairingsForWeek(weekId: string) {
  const rows = (await executeSql(
    `SELECT home_team_id, away_team_id, match_number FROM matches WHERE season_week_id=$1 ORDER BY match_number`, [weekId],
  )) as Array<{ home_team_id: string; away_team_id: string; match_number: number }>;
  return rows.map((r) => `${r.match_number}:${r.home_team_id}->${r.away_team_id}`);
}
async function seasonMeta(seasonId: string) {
  const rows = (await executeSql(`SELECT season_length, to_char(end_date,'YYYY-MM-DD') AS end_date FROM seasons WHERE id=$1`, [seasonId])) as Array<{ season_length: number; end_date: string }>;
  return rows[0];
}

afterAll(async () => {
  for (const s of created.seasons) {
    await executeSql(`DELETE FROM matches WHERE season_id=$1`, [s]);
    await executeSql(`DELETE FROM season_weeks WHERE season_id=$1`, [s]);
    await executeSql(`DELETE FROM teams WHERE season_id=$1`, [s]);
    await executeSql(`DELETE FROM seasons WHERE id=$1`, [s]);
  }
  for (const l of created.leagues) await executeSql(`DELETE FROM leagues WHERE id=$1`, [l]);
  for (const o of created.orgs) await executeSql(`DELETE FROM organizations WHERE id=$1`, [o]);
  for (const m of created.members) await executeSql(`DELETE FROM members WHERE id=$1`, [m]);
});

describe('applySeasonLengthChange', () => {
  it('lengthen: appends paired weeks, leaves existing matches untouched, orders before playoffs', async () => {
    const { seasonId } = await buildSeason(4, 12);
    const weeksBefore = await readWeeks(seasonId);
    const regularBefore = weeksBefore.filter((w) => w.type === 'regular');
    const matchesBefore = await readMatches(seasonId);

    const result = await applySeasonLengthChange(seasonId, 14);
    expect(result.success).toBe(true);

    const weeksAfter = await readWeeks(seasonId);
    const regularAfter = weeksAfter.filter((w) => w.type === 'regular');
    expect(regularAfter).toHaveLength(14);

    // New regular weeks land BEFORE the break/playoff (ordering by date).
    const types = weeksAfter.map((w) => w.type);
    expect(types.slice(0, 14).every((t) => t === 'regular')).toBe(true);
    expect(types.slice(14)).toEqual(['season_end_break', 'playoffs']);

    // Every pre-existing match is byte-identical (same id → same row).
    const afterById = new Map((await readMatches(seasonId)).map((m) => [m.id as string, m]));
    for (const before of matchesBefore) {
      expect(afterById.get(before.id as string)).toEqual(before);
    }

    // Rotation continues: new week 13 (index 12, %3==0) pairs like week 1; week 14 like week 2.
    const newWk13 = regularAfter[12], newWk14 = regularAfter[13];
    expect(await pairingsForWeek(newWk13.id)).toEqual(await pairingsForWeek(regularBefore[0].id));
    expect(await pairingsForWeek(newWk14.id)).toEqual(await pairingsForWeek(regularBefore[1].id));

    // Break/playoff pushed out 2 weeks; meta synced.
    expect(weeksAfter.find((w) => w.type === 'playoffs')!.date).toBe(wed(15));
    const meta = await seasonMeta(seasonId);
    expect(meta.season_length).toBe(14);
    expect(meta.end_date).toBe(wed(15));
  });

  it('lengthen: freezes the chart to stored positions even after a team withdraws', async () => {
    const { seasonId, teamIds } = await buildSeason(4, 12);
    await executeSql(`UPDATE teams SET status='withdrawn' WHERE id=$1`, [teamIds[0]]);

    const result = await applySeasonLengthChange(seasonId, 13);
    expect(result.success).toBe(true);

    // The one appended week still has a full slate (4 teams = 2 matches), not mis-keyed.
    const regularAfter = (await readWeeks(seasonId)).filter((w) => w.type === 'regular');
    expect(regularAfter).toHaveLength(13);
    const newWeek = regularAfter[12];
    expect(await pairingsForWeek(newWeek.id)).toHaveLength(2);
  });

  it('shorten: trims the tail and pulls break/playoff in', async () => {
    const { seasonId } = await buildSeason(4, 12);
    const matchesBefore = await readMatches(seasonId);

    const result = await applySeasonLengthChange(seasonId, 10);
    expect(result.success).toBe(true);

    const weeksAfter = await readWeeks(seasonId);
    expect(weeksAfter.filter((w) => w.type === 'regular')).toHaveLength(10);
    expect(weeksAfter.map((w) => w.type).slice(10)).toEqual(['season_end_break', 'playoffs']);
    // Playoffs pulled in to right after the new last regular (week 10 = wed(9)).
    expect(weeksAfter.find((w) => w.type === 'playoffs')!.date).toBe(wed(11));

    // Surviving matches (weeks 1-10) are untouched; only weeks 11-12's were deleted.
    const afterIds = new Set((await readMatches(seasonId)).map((m) => m.id));
    const deleted = matchesBefore.filter((m) => !afterIds.has(m.id));
    expect(deleted.length).toBeGreaterThan(0); // some removed
    const meta = await seasonMeta(seasonId);
    expect(meta.season_length).toBe(10);
  });

  it('shorten: REFUSES to delete a week that has a played match', async () => {
    const { seasonId } = await buildSeason(4, 12);
    // Mark a match in the last regular week (week 12) as completed.
    const wk12 = (await readWeeks(seasonId)).filter((w) => w.type === 'regular')[11];
    await executeSql(`UPDATE matches SET status='completed' WHERE season_week_id=$1`, [wk12.id]);
    const weeksBefore = await readWeeks(seasonId);

    const result = await applySeasonLengthChange(seasonId, 10);
    expect(result.success).toBe(false);
    expect(result.blockedWeekName).toBe('Week 12');
    // Nothing changed.
    expect(await readWeeks(seasonId)).toEqual(weeksBefore);
  });

  it('lengthen: a pre-column season (null positions) is refused with a regenerate message', async () => {
    const { seasonId } = await buildSeason(4, 12);
    await executeSql(`UPDATE teams SET schedule_position=NULL WHERE season_id=$1`, [seasonId]);

    const result = await applySeasonLengthChange(seasonId, 14);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/regenerate/i);
  });
});
