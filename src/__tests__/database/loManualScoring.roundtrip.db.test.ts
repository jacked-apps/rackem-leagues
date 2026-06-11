// @vitest-environment jsdom
/**
 * @fileoverview DB round-trip integration test for LO manual scoring (Unit 7).
 *
 * Proves the WHOLE flow against the real local Postgres: build a scheduled
 * match, then run the actual LO data-layer functions end to end —
 * loSaveLineups -> loSetupMatch (prep_match) -> loScoreGame x N -> loFinalizeMatch
 * — and assert the saved rows. This is the automated version of the manual pass:
 * a Fargo games-won match (pure thresholds, no chart dependency), all games won
 * by home, should finalize as a completed home win with every game double-
 * confirmed by the operator.
 *
 * Uses an isolated, dummy fixture (unique ids) and cleans it up afterward — no
 * shared seed rows are touched (db project runs sequentially on one Postgres).
 *
 * NOTE: the minimal fixture has no league format config, so resolved prefs fall
 * back to a default *points* calculator. Running it under a games-won framing
 * makes the existing engine-vs-legacy shadow audit log POINTS divergence
 * warnings to stderr. That is expected noise, not a failure — the asserted
 * values (games-won, winner, status, double-confirmation) are deterministic and
 * exercise the LO write/finalize path, which is the point of this test.
 *
 * @see docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md — Unit 7
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { executeSql } from '@/test/dbTestUtils';
import {
  loSaveLineups,
  loSetupMatch,
  loScoreGame,
  loFinalizeMatch,
} from '@/api/mutations/loManualScoring';

const LINEUP_SIZE = 3;

// All ids we create, so afterAll can delete exactly our rows.
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
let operatorId = '';
let homePlayers: string[] = [];
let awayPlayers: string[] = [];

async function makeMember(): Promise<string> {
  const id = randomUUID();
  await executeSql(
    `INSERT INTO members (id, first_name, last_name, city, state) VALUES ($1,'Test','Player','Town','ST')`,
    [id]
  );
  ids.members.push(id);
  return id;
}

beforeAll(async () => {
  operatorId = await makeMember();
  homePlayers = [await makeMember(), await makeMember(), await makeMember()];
  awayPlayers = [await makeMember(), await makeMember(), await makeMember()];

  await executeSql(
    `INSERT INTO organizations (id, created_by, organization_name, organization_address,
        organization_city, organization_state, organization_zip_code, organization_email,
        organization_phone, stripe_customer_id, payment_method_id, card_last4, card_brand,
        expiry_month, expiry_year, billing_zip)
     VALUES ($1,$2,'LO Test Org','1 St','Town','ST','00000','o@test.com','555','cus','pm','4242','visa',1,2030,'00000')`,
    [ids.org, operatorId]
  );
  await executeSql(
    `INSERT INTO leagues (id, organization_id, game_type, day_of_week, league_start_date)
     VALUES ($1,$2,'eight_ball','monday','2026-01-01')`,
    [ids.league, ids.org]
  );
  await executeSql(
    `INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length)
     VALUES ($1,$2,'LO Test Season','2026-01-01','2026-06-01',10)`,
    [ids.season, ids.league]
  );
  await executeSql(
    `INSERT INTO season_weeks (id, season_id, scheduled_date, week_name, week_type)
     VALUES ($1,$2,'2026-02-01','Week 1','regular')`,
    [ids.week, ids.season]
  );
  for (const [tid, name] of [[ids.homeTeam, 'Home'], [ids.awayTeam, 'Away']] as const) {
    await executeSql(
      `INSERT INTO teams (id, season_id, league_id, team_name, roster_size) VALUES ($1,$2,$3,$4,5)`,
      [tid, ids.season, ids.league, name]
    );
  }
  for (const m of homePlayers) {
    await executeSql(`INSERT INTO team_players (team_id, member_id, season_id) VALUES ($1,$2,$3)`, [ids.homeTeam, m, ids.season]);
  }
  for (const m of awayPlayers) {
    await executeSql(`INSERT INTO team_players (team_id, member_id, season_id) VALUES ($1,$2,$3)`, [ids.awayTeam, m, ids.season]);
  }
  await executeSql(
    `INSERT INTO matches (id, season_id, season_week_id, match_number, home_team_id, away_team_id, status)
     VALUES ($1,$2,$3,1,$4,$5,'scheduled')`,
    [ids.match, ids.season, ids.week, ids.homeTeam, ids.awayTeam]
  );
});

afterAll(async () => {
  // Delete in FK-safe order; ignore errors so a partial fixture still cleans up.
  const del = async (sql: string, p: unknown[] = []) => {
    try { await executeSql(sql, p); } catch { /* best-effort cleanup */ }
  };
  await del(`DELETE FROM match_games WHERE match_id=$1`, [ids.match]);
  await del(`DELETE FROM match_lineups WHERE match_id=$1`, [ids.match]);
  await del(`DELETE FROM matches WHERE id=$1`, [ids.match]);
  await del(`DELETE FROM team_players WHERE season_id=$1`, [ids.season]);
  await del(`DELETE FROM teams WHERE id IN ($1,$2)`, [ids.homeTeam, ids.awayTeam]);
  await del(`DELETE FROM season_weeks WHERE id=$1`, [ids.week]);
  await del(`DELETE FROM seasons WHERE id=$1`, [ids.season]);
  await del(`DELETE FROM leagues WHERE id=$1`, [ids.league]);
  await del(`DELETE FROM organizations WHERE id=$1`, [ids.org]);
  if (ids.members.length) {
    await del(`DELETE FROM members WHERE id = ANY($1::uuid[])`, [ids.members]);
  }
});

describe('LO manual scoring — DB round-trip', () => {
  it('setup -> score all -> finalize produces a completed, correctly-scored match', async () => {
    // 1. Save both lineups (gate-free, locked).
    await loSaveLineups({
      matchId: ids.match,
      homeTeamId: ids.homeTeam,
      awayTeamId: ids.awayTeam,
      homePlayers: homePlayers.map((id, i) => ({ position: i + 1, playerId: id, handicap: 500 })),
      awayPlayers: awayPlayers.map((id, i) => ({ position: i + 1, playerId: id, handicap: 500 })),
    });

    // 2. Setup the match (Fargo games-won: pure thresholds, no chart lookup).
    await loSetupMatch({
      matchId: ids.match,
      leagueId: ids.league,
      lineupSize: LINEUP_SIZE,
      handicapType: 'fargo',
      winCondition: 'games',
      gameGeneration: 'single_round_robin',
      gameType: 'eight_ball',
    });

    // prep_match created the games; loSetupMatch then re-stamped the match to the
    // LO-entry state 'updating' (kept off the players' live-scoring surfaces).
    const created = await executeSql(
      `SELECT id, game_number, home_player_id FROM match_games WHERE match_id=$1 ORDER BY game_number`,
      [ids.match]
    );
    expect(created.length).toBe(9); // 3v3 single round-robin

    const statusAfterSetup = await executeSql(`SELECT status FROM matches WHERE id=$1`, [ids.match]);
    expect(statusAfterSetup[0].status).toBe('updating');

    // 3. Score every game as a home win (winner = that game's home player).
    for (const g of created) {
      await loScoreGame({
        matchId: ids.match,
        gameId: g.id,
        loMemberId: operatorId,
        result: { winnerTeamId: ids.homeTeam, winnerPlayerId: g.home_player_id },
      });
    }

    // Every game is scored AND double-confirmed by the operator.
    const games = await executeSql(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE winner_player_id IS NOT NULL)::int AS scored,
              count(*) FILTER (WHERE confirmed_by_home=$2 AND confirmed_by_away=$2)::int AS both_by_lo
       FROM match_games WHERE match_id=$1`,
      [ids.match, operatorId]
    );
    expect(games[0].total).toBe(9);
    expect(games[0].scored).toBe(9);
    expect(games[0].both_by_lo).toBe(9);

    // Running totals reflect a 9-0 home sweep.
    const totals = await executeSql(
      `SELECT home_games_won, away_games_won FROM matches WHERE id=$1`,
      [ids.match]
    );
    expect(totals[0].home_games_won).toBe(9);
    expect(totals[0].away_games_won).toBe(0);

    // 4. Finalize.
    const result = await loFinalizeMatch({
      matchId: ids.match,
      loMemberId: operatorId,
      winCondition: 'games',
    });
    expect(result.result).toBe('home_win');
    expect(result.winnerTeamId).toBe(ids.homeTeam);

    // The match is completed, won by home, verified by the operator on both sides.
    const final = await executeSql(
      `SELECT status, winner_team_id, match_result, home_team_verified_by, away_team_verified_by
       FROM matches WHERE id=$1`,
      [ids.match]
    );
    expect(final[0].status).toBe('completed');
    expect(final[0].winner_team_id).toBe(ids.homeTeam);
    expect(final[0].match_result).toBe('home_win');
    expect(final[0].home_team_verified_by).toBe(operatorId);
    expect(final[0].away_team_verified_by).toBe(operatorId);
  });
});
