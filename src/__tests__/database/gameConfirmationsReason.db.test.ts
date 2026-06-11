// @vitest-environment jsdom
/**
 * @fileoverview DB test for the `reason` column on game_confirmations (Unit 1 of
 * LO match review & correction). Verifies the optional reason persists, defaults
 * to null, and is length-capped at 255 by the CHECK constraint.
 *
 * Uses an isolated dummy match + members fixture (unique ids) and cleans up.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { executeSql } from '@/test/dbTestUtils';

const ids = {
  member: randomUUID(),
  org: randomUUID(),
  league: randomUUID(),
  season: randomUUID(),
  week: randomUUID(),
  team: randomUUID(),
  match: randomUUID(),
  game: randomUUID(),
};

beforeAll(async () => {
  await executeSql(
    `INSERT INTO members (id, first_name, last_name, city, state) VALUES ($1,'T','P','Town','ST')`,
    [ids.member]
  );
  await executeSql(
    `INSERT INTO organizations (id, created_by, organization_name, organization_address, organization_city,
        organization_state, organization_zip_code, organization_email, organization_phone, stripe_customer_id,
        payment_method_id, card_last4, card_brand, expiry_month, expiry_year, billing_zip)
     VALUES ($1,$2,'O','1 St','Town','ST','00000','o@t.com','555','c','p','4242','visa',1,2030,'00000')`,
    [ids.org, ids.member]
  );
  await executeSql(
    `INSERT INTO leagues (id, organization_id, game_type, day_of_week, league_start_date) VALUES ($1,$2,'eight_ball','monday','2026-01-01')`,
    [ids.league, ids.org]
  );
  await executeSql(
    `INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length) VALUES ($1,$2,'S','2026-01-01','2026-06-01',10)`,
    [ids.season, ids.league]
  );
  await executeSql(
    `INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type) VALUES ($1,$2,'2026-02-01','W','regular')`,
    [ids.week, ids.season]
  );
  await executeSql(
    `INSERT INTO teams (id, season_id, league_id, team_name, roster_size) VALUES ($1,$2,$3,'Home',5)`,
    [ids.team, ids.season, ids.league]
  );
  await executeSql(
    `INSERT INTO matches (id, season_id, season_week_id, match_number, home_team_id, status) VALUES ($1,$2,$3,1,$4,'scheduled')`,
    [ids.match, ids.season, ids.week, ids.team]
  );
  await executeSql(
    `INSERT INTO match_games (id, match_id, game_number, home_action, away_action, game_type) VALUES ($1,$2,1,'breaks','racks','eight_ball')`,
    [ids.game, ids.match]
  );
});

afterAll(async () => {
  const del = async (s: string, p: unknown[]) => { try { await executeSql(s, p); } catch { /* best-effort */ } };
  await del(`DELETE FROM game_confirmations WHERE match_id=$1`, [ids.match]);
  await del(`DELETE FROM match_games WHERE id=$1`, [ids.game]);
  await del(`DELETE FROM matches WHERE id=$1`, [ids.match]);
  await del(`DELETE FROM teams WHERE id=$1`, [ids.team]);
  await del(`DELETE FROM season_weeks WHERE id=$1`, [ids.week]);
  await del(`DELETE FROM seasons WHERE id=$1`, [ids.season]);
  await del(`DELETE FROM leagues WHERE id=$1`, [ids.league]);
  await del(`DELETE FROM organizations WHERE id=$1`, [ids.org]);
  await del(`DELETE FROM members WHERE id=$1`, [ids.member]);
});

async function insertConfirmation(reason: string | null) {
  return executeSql(
    `INSERT INTO game_confirmations (match_id, game_id, game_number, confirmer_id, side, action, reason)
     VALUES ($1,$2,1,$3,'home','confirm',$4) RETURNING reason`,
    [ids.match, ids.game, ids.member, reason]
  );
}

describe('game_confirmations.reason column', () => {
  it('persists a reason', async () => {
    const rows = await insertConfirmation('John flagged game 6 — confirmed unmarked. Corrected.');
    expect(rows[0].reason).toMatch(/Corrected/);
  });

  it('defaults to null when omitted', async () => {
    const rows = await executeSql(
      `INSERT INTO game_confirmations (match_id, game_id, game_number, confirmer_id, side, action)
       VALUES ($1,$2,1,$3,'away','confirm') RETURNING reason`,
      [ids.match, ids.game, ids.member]
    );
    expect(rows[0].reason).toBeNull();
  });

  it('rejects a reason longer than 255 chars (CHECK)', async () => {
    await expect(insertConfirmation('x'.repeat(256))).rejects.toThrow();
  });
});
