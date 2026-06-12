// @vitest-environment jsdom
/**
 * @fileoverview DB integration test for persisting team schedule positions (Unit 2).
 *
 * Proves that creating a season's matchups via `generateSchedule` writes each team's
 * `schedule_position` to the `teams` row — including the materialized bye team — so
 * the "Change Season Length" append step can read it back later.
 *
 * Isolated, unique-id fixtures; cleaned up afterward (db project runs sequentially on
 * one shared Postgres).
 *
 * @see docs/plans/2026-06-11-002-feat-change-season-length-plan.md — Unit 2
 */
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { executeSql } from '@/test/dbTestUtils';
import { generateSchedule } from '@/utils/scheduleGenerator';
import type { TeamWithPosition } from '@/types/schedule';

// Track everything created so afterAll can tear it down.
const created = {
  seasons: [] as string[],
  leagues: [] as string[],
  orgs: [] as string[],
  members: [] as string[],
};

async function makeMember(): Promise<string> {
  const id = randomUUID();
  await executeSql(
    `INSERT INTO members (id, first_name, last_name, city, state) VALUES ($1,'Pos','Tester','Town','ST')`,
    [id],
  );
  created.members.push(id);
  return id;
}

/**
 * Seed a season with `realTeamCount` real teams + 3 regular weeks. Returns the season
 * id and the real teams' ids in creation order.
 */
async function seedSeason(realTeamCount: number): Promise<{ seasonId: string; teamIds: string[] }> {
  const orgId = randomUUID();
  const leagueId = randomUUID();
  const seasonId = randomUUID();
  const creator = await makeMember();

  await executeSql(
    `INSERT INTO organizations (id, created_by, organization_name, organization_address,
        organization_city, organization_state, organization_zip_code, organization_email,
        organization_phone, stripe_customer_id, payment_method_id, card_last4, card_brand,
        expiry_month, expiry_year, billing_zip)
     VALUES ($1,$2,'Pos Org','1 St','Town','ST','00000','o@test.com','555','cus','pm','4242','visa',1,2030,'00000')`,
    [orgId, creator],
  );
  created.orgs.push(orgId);
  await executeSql(
    `INSERT INTO leagues (id, organization_id, game_type, day_of_week, league_start_date)
     VALUES ($1,$2,'eight_ball','wednesday','2026-07-01')`,
    [leagueId, orgId],
  );
  created.leagues.push(leagueId);
  await executeSql(
    `INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length)
     VALUES ($1,$2,'Pos Season','2026-07-01','2026-07-29',10)`,
    [seasonId, leagueId],
  );
  created.seasons.push(seasonId);

  // 3 regular weeks (one short cycle is enough to generate matches).
  for (let i = 0; i < 3; i++) {
    await executeSql(
      `INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type)
       VALUES ($1,$2,$3,$4,'regular')`,
      [randomUUID(), seasonId, `2026-07-${String(1 + i * 7).padStart(2, '0')}`, `Week ${i + 1}`],
    );
  }

  const teamIds: string[] = [];
  for (let i = 0; i < realTeamCount; i++) {
    const teamId = randomUUID();
    const captain = await makeMember();
    await executeSql(
      `INSERT INTO teams (id, season_id, league_id, captain_id, team_name, roster_size)
       VALUES ($1,$2,$3,$4,$5,5)`,
      [teamId, seasonId, leagueId, captain, `Team ${i + 1}`],
    );
    teamIds.push(teamId);
  }
  return { seasonId, teamIds };
}

/** Read each team's persisted position for a season (active + bye), keyed by id. */
async function readPositions(seasonId: string): Promise<Record<string, number | null>> {
  const rows = (await executeSql(
    `SELECT id, schedule_position FROM teams WHERE season_id=$1`,
    [seasonId],
  )) as Array<{ id: string; schedule_position: number | null }>;
  return Object.fromEntries(rows.map((r) => [r.id, r.schedule_position]));
}

const posArg = (id: string, schedule_position: number): TeamWithPosition => ({
  id,
  team_name: id === 'BYE' ? 'BYE' : `T-${id.slice(0, 4)}`,
  home_venue_id: null,
  schedule_position,
});

afterAll(async () => {
  for (const seasonId of created.seasons) {
    await executeSql(`DELETE FROM matches WHERE season_id=$1`, [seasonId]);
    await executeSql(`DELETE FROM season_weeks WHERE season_id=$1`, [seasonId]);
    await executeSql(`DELETE FROM teams WHERE season_id=$1`, [seasonId]);
    await executeSql(`DELETE FROM seasons WHERE id=$1`, [seasonId]);
  }
  for (const leagueId of created.leagues) await executeSql(`DELETE FROM leagues WHERE id=$1`, [leagueId]);
  for (const orgId of created.orgs) await executeSql(`DELETE FROM organizations WHERE id=$1`, [orgId]);
  for (const memberId of created.members) await executeSql(`DELETE FROM members WHERE id=$1`, [memberId]);
});

describe('persist schedule_position at matchup creation', () => {
  it('even teams: each team gets its sequential position', async () => {
    const { seasonId, teamIds } = await seedSeason(4);
    const positions = teamIds.map((id, i) => posArg(id, i + 1));

    const result = await generateSchedule({ seasonId, teams: positions, skipExistingCheck: true });
    expect(result.success).toBe(true);

    const stored = await readPositions(seasonId);
    teamIds.forEach((id, i) => expect(stored[id]).toBe(i + 1));
  });

  it('odd teams: the materialized bye team also carries its position', async () => {
    const { seasonId, teamIds } = await seedSeason(5);
    // 5 real teams at 1..5, BYE sentinel at position 6 (6-team chart).
    const positions = [...teamIds.map((id, i) => posArg(id, i + 1)), posArg('BYE', 6)];

    const result = await generateSchedule({ seasonId, teams: positions, skipExistingCheck: true });
    expect(result.success).toBe(true);

    const stored = await readPositions(seasonId);
    teamIds.forEach((id, i) => expect(stored[id]).toBe(i + 1));

    // The bye team is a real row (status='bye') with position 6.
    const byeRows = (await executeSql(
      `SELECT schedule_position FROM teams WHERE season_id=$1 AND status='bye'`,
      [seasonId],
    )) as Array<{ schedule_position: number | null }>;
    expect(byeRows).toHaveLength(1);
    expect(byeRows[0].schedule_position).toBe(6);
  });

  it('non-sequential positions are stored exactly as passed (not renumbered)', async () => {
    const { seasonId, teamIds } = await seedSeason(4);
    // Deliberately scramble: team0→3, team1→1, team2→2, team3→4.
    const wanted = [3, 1, 2, 4];
    const positions = teamIds.map((id, i) => posArg(id, wanted[i]));

    const result = await generateSchedule({ seasonId, teams: positions, skipExistingCheck: true });
    expect(result.success).toBe(true);

    const stored = await readPositions(seasonId);
    teamIds.forEach((id, i) => expect(stored[id]).toBe(wanted[i]));
  });
});
