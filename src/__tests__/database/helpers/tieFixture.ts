/**
 * @fileoverview Throwaway tied-match fixture for the tiebreak-record DB tests
 * (Units 2 and 3 of docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md).
 *
 * Builds org → league → season → week → two teams → one match with
 * match_result 'tie', fills both match lineups and LOCKS them (as they are when
 * a match ties), and returns a cleanup that deletes exactly what it made.
 * Raw SQL only — the tests drive the code under test through supabase-js.
 */

import { randomUUID } from 'crypto';
import { executeSql } from '@/test/dbTestUtils';

export interface TieFixture {
  match: string;
  homeTeam: string;
  awayTeam: string;
  /** Member id in each home match-lineup slot, in slot order. */
  homeSlots: string[];
  awaySlots: string[];
  /** Full match_lineups rows as JSON — compare before/after for byte-identity. */
  matchLineupRows: () => Promise<string>;
  cleanup: () => Promise<void>;
}

/**
 * Create a tied match.
 *
 * @param homePattern - Home lineup slots by letter; a repeated letter is the
 *   SAME member (double duty), e.g. ['a','b','a']. Up to 5 slots.
 * @param awaySize - Number of distinct away players (3 by default)
 */
export async function createTieFixture(homePattern: string[], awaySize = 3): Promise<TieFixture> {
  const ids = {
    members: [] as string[], org: randomUUID(), league: randomUUID(), season: randomUUID(),
    week: randomUUID(), homeTeam: randomUUID(), awayTeam: randomUUID(), match: randomUUID(),
  };
  const member = async () => {
    const id = randomUUID();
    await executeSql(
      `INSERT INTO members (id, first_name, last_name, city, state) VALUES ($1,'Tb','Player','Town','ST')`, [id]);
    ids.members.push(id);
    return id;
  };

  const lo = await member();
  await executeSql(
    `INSERT INTO organizations (id, created_by, organization_name, organization_address,
        organization_city, organization_state, organization_zip_code, organization_email,
        organization_phone, stripe_customer_id, payment_method_id, card_last4, card_brand,
        expiry_month, expiry_year, billing_zip)
     VALUES ($1,$2,'Tb Org','1 St','Town','ST','00000','o@test.com','555','cus','pm','4242','visa',1,2030,'00000')`,
    [ids.org, lo]);
  await executeSql(`INSERT INTO leagues (id, organization_id, game_type, day_of_week, league_start_date)
     VALUES ($1,$2,'eight_ball','monday','2026-01-01')`, [ids.league, ids.org]);
  await executeSql(`INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length)
     VALUES ($1,$2,'Tb Season','2026-01-01','2026-06-01',10)`, [ids.season, ids.league]);
  await executeSql(`INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type)
     VALUES ($1,$2,'2026-02-01','Week 1','regular')`, [ids.week, ids.season]);
  for (const [tid, name] of [[ids.homeTeam, 'Home'], [ids.awayTeam, 'Away']] as const) {
    await executeSql(`INSERT INTO teams (id, season_id, league_id, team_name, roster_size) VALUES ($1,$2,$3,$4,5)`,
      [tid, ids.season, ids.league, name]);
  }
  // The trigger auto-creates both match lineups.
  await executeSql(
    `INSERT INTO matches (id, season_id, season_week_id, match_number, home_team_id, away_team_id, status, match_result)
     VALUES ($1,$2,$3,1,$4,$5,'in_progress','tie')`,
    [ids.match, ids.season, ids.week, ids.homeTeam, ids.awayTeam]);

  const byLetter = new Map<string, string>();
  const homeSlots: string[] = [];
  for (const letter of homePattern) {
    if (!byLetter.has(letter)) byLetter.set(letter, await member());
    homeSlots.push(byLetter.get(letter)!);
  }
  const awaySlots: string[] = [];
  for (let i = 0; i < awaySize; i++) awaySlots.push(await member());

  for (const [team, slots] of [[ids.homeTeam, homeSlots], [ids.awayTeam, awaySlots]] as const) {
    const sets = slots.map((_, i) => `player${i + 1}_id=$${i + 3}, player${i + 1}_handicap=${i - 1}`).join(', ');
    await executeSql(`UPDATE match_lineups SET ${sets}, locked=true WHERE match_id=$1 AND team_id=$2`,
      [ids.match, team, ...slots]);
  }

  return {
    match: ids.match, homeTeam: ids.homeTeam, awayTeam: ids.awayTeam, homeSlots, awaySlots,
    matchLineupRows: async () => {
      const rows = await executeSql(
        `SELECT to_jsonb(ml) AS r FROM match_lineups ml WHERE match_id = $1 ORDER BY team_id`, [ids.match]);
      return JSON.stringify(rows.map((x: { r: unknown }) => x.r));
    },
    cleanup: async () => {
      const del = async (sql: string, p: unknown[]) => {
        try { await executeSql(sql, p); } catch { /* best-effort cleanup */ }
      };
      await del(`DELETE FROM match_tiebreakers WHERE match_id=$1`, [ids.match]);
      await del(`DELETE FROM match_games WHERE match_id=$1`, [ids.match]);
      await del(`DELETE FROM matches WHERE id=$1`, [ids.match]);
      await del(`DELETE FROM teams WHERE id IN ($1,$2)`, [ids.homeTeam, ids.awayTeam]);
      await del(`DELETE FROM season_weeks WHERE id=$1`, [ids.week]);
      await del(`DELETE FROM seasons WHERE id=$1`, [ids.season]);
      await del(`DELETE FROM leagues WHERE id=$1`, [ids.league]);
      await del(`DELETE FROM organizations WHERE id=$1`, [ids.org]);
      await del(`DELETE FROM members WHERE id = ANY($1::uuid[])`, [ids.members]);
    },
  };
}
