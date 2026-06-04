// @vitest-environment jsdom
/**
 * @fileoverview DB round-trip integration test for LO match review & correction
 * (Unit 8). Proves the correction lifecycle against the real local Postgres.
 *
 * Builds a COMPLETED match (via the v1 path), then seeds pre-existing TEAM
 * `game_confirmations` rows on one game — the v1 round-trip fixture is log-free,
 * so it can't exercise append-only preservation against real team confirmers.
 * Then runs the actual v2 data layer end to end:
 *
 *   loReopenMatch → loVacateGame → loCorrectGame → loFinalizeMatch
 *
 * and asserts: the match reopens crash-safe (status `in_progress` but
 * `completed_at` still set); the vacate marker + operator confirm rows are
 * appended WITH the operator reason; the original team confirm rows survive
 * (append-only); `match_games` reflects the corrected winner; the match
 * re-completes with the recomputed winner. A second case proves the restore
 * escape (the tie-block recovery) re-stamps the prior completed result.
 *
 * Standings eligibility is asserted via the status transition itself — a
 * standings read filters `status = 'completed'`, so reopened (`in_progress`)
 * excludes the match and re-finalized (`completed`) re-includes it. Forcing a
 * real threshold-tie is non-deterministic with this minimal fixture, so the
 * restore mechanic (identical to the tie-block's escape) is proven directly.
 *
 * Isolated, unique-id fixture; cleaned up afterward (db project runs
 * sequentially on one shared Postgres).
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Unit 8
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { executeSql } from '@/test/dbTestUtils';
import {
  loSaveLineups,
  loSetupMatch,
  loScoreGame,
  loFinalizeMatch,
  loReopenMatch,
  loVacateGame,
  loCorrectGame,
  loRestoreCompletion,
} from '@/api/mutations/loManualScoring';

const LINEUP_SIZE = 3;
const VACATE_REASON = 'Player reported game 1 was scored to the wrong team.';
const CORRECT_REASON = 'Corrected game 1 to the away winner per the paper sheet.';

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
let g1: { id: string; home_player_id: string; away_player_id: string };

async function makeMember(): Promise<string> {
  const id = randomUUID();
  await executeSql(
    `INSERT INTO members (id, first_name, last_name, city, state) VALUES ($1,'Test','Player','Town','ST')`,
    [id]
  );
  ids.members.push(id);
  return id;
}

/** Seed a pre-existing TEAM confirm row directly (bypasses the finalized guard). */
async function seedTeamConfirm(
  gameId: string,
  gameNumber: number,
  confirmerId: string,
  side: 'home' | 'away',
  winnerTeamId: string,
  winnerPlayerId: string
) {
  await executeSql(
    `INSERT INTO game_confirmations
       (match_id, game_id, game_number, confirmer_id, side, action, is_initiator,
        auto_confirmed, winner_team_id, winner_player_id, break_and_run, golden_break,
        break_fouled, runout, win_by_forfeit)
     VALUES ($1,$2,$3,$4,$5,'confirm',false,false,$6,$7,false,false,false,false,false)`,
    [ids.match, gameId, gameNumber, confirmerId, side, winnerTeamId, winnerPlayerId]
  );
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
     VALUES ($1,$2,'LO Review Org','1 St','Town','ST','00000','o@test.com','555','cus','pm','4242','visa',1,2030,'00000')`,
    [ids.org, operatorId]
  );
  await executeSql(
    `INSERT INTO leagues (id, organization_id, game_type, day_of_week, league_start_date)
     VALUES ($1,$2,'eight_ball','monday','2026-01-01')`,
    [ids.league, ids.org]
  );
  await executeSql(
    `INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length)
     VALUES ($1,$2,'LO Review Season','2026-01-01','2026-06-01',10)`,
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

  // Drive to a COMPLETED home-sweep match via the v1 path.
  await loSaveLineups({
    matchId: ids.match,
    homeTeamId: ids.homeTeam,
    awayTeamId: ids.awayTeam,
    homePlayers: homePlayers.map((id, i) => ({ position: i + 1, playerId: id, handicap: 500 })),
    awayPlayers: awayPlayers.map((id, i) => ({ position: i + 1, playerId: id, handicap: 500 })),
  });
  await loSetupMatch({
    matchId: ids.match,
    leagueId: ids.league,
    lineupSize: LINEUP_SIZE,
    handicapType: 'fargo',
    winCondition: 'games',
    gameGeneration: 'single_round_robin',
    gameType: 'eight_ball',
  });
  const created = await executeSql(
    `SELECT id, game_number, home_player_id, away_player_id FROM match_games WHERE match_id=$1 ORDER BY game_number`,
    [ids.match]
  );
  for (const g of created) {
    await loScoreGame({
      matchId: ids.match,
      gameId: g.id,
      loMemberId: operatorId,
      result: { winnerTeamId: ids.homeTeam, winnerPlayerId: g.home_player_id },
    });
  }
  await loFinalizeMatch({ matchId: ids.match, loMemberId: operatorId, winCondition: 'games' });

  g1 = created[0];
  // Seed pre-existing TEAM confirmations on game 1 (a home + an away voucher),
  // as if the teams had scored it live before the correction.
  await seedTeamConfirm(g1.id, 1, homePlayers[1], 'home', ids.homeTeam, g1.home_player_id);
  await seedTeamConfirm(g1.id, 1, awayPlayers[0], 'away', ids.homeTeam, g1.home_player_id);
});

afterAll(async () => {
  const del = async (sql: string, p: unknown[] = []) => {
    try { await executeSql(sql, p); } catch { /* best-effort cleanup */ }
  };
  await del(`DELETE FROM game_confirmations WHERE match_id=$1`, [ids.match]);
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

describe('LO match review & correction — DB round-trip', () => {
  it('reopen → vacate → re-score → re-finalize corrects the match append-only', async () => {
    // The seeded team confirmations exist before we touch anything.
    const seededBefore = await executeSql(
      `SELECT count(*)::int AS n FROM game_confirmations
       WHERE game_id=$1 AND confirmer_id <> $2`,
      [g1.id, operatorId]
    );
    expect(seededBefore[0].n).toBe(2);

    // 1. Reopen — crash-safe: status flips but completion fields stay (recovery signal).
    await loReopenMatch(ids.match);
    const reopened = await executeSql(
      `SELECT status, completed_at, winner_team_id FROM matches WHERE id=$1`,
      [ids.match]
    );
    expect(reopened[0].status).toBe('in_progress'); // excluded from standings while reopened
    expect(reopened[0].completed_at).not.toBeNull(); // abandoned-reopen detectable
    expect(reopened[0].winner_team_id).toBe(ids.homeTeam); // prior winner still on the row

    // 2. Vacate game 1 with an operator reason.
    await loVacateGame({ matchId: ids.match, gameId: g1.id, loMemberId: operatorId, reason: VACATE_REASON });
    const wiped = await executeSql(
      `SELECT winner_player_id, confirmed_by_home, confirmed_by_away FROM match_games WHERE id=$1`,
      [g1.id]
    );
    expect(wiped[0].winner_player_id).toBeNull();
    expect(wiped[0].confirmed_by_home).toBeNull();
    expect(wiped[0].confirmed_by_away).toBeNull();

    const vacateRow = await executeSql(
      `SELECT confirmer_id, reason FROM game_confirmations
       WHERE game_id=$1 AND action='vacate'`,
      [g1.id]
    );
    expect(vacateRow.length).toBe(1);
    expect(vacateRow[0].confirmer_id).toBe(operatorId);
    expect(vacateRow[0].reason).toBe(VACATE_REASON);

    // The original TEAM confirm rows are untouched (append-only).
    const seededAfterVacate = await executeSql(
      `SELECT count(*)::int AS n FROM game_confirmations
       WHERE game_id=$1 AND confirmer_id <> $2 AND action='confirm'`,
      [g1.id, operatorId]
    );
    expect(seededAfterVacate[0].n).toBe(2);

    // 3. Re-score game 1 the OTHER way (away win) with a reason.
    await loCorrectGame({
      matchId: ids.match,
      gameId: g1.id,
      loMemberId: operatorId,
      result: { winnerTeamId: ids.awayTeam, winnerPlayerId: g1.away_player_id },
      reason: CORRECT_REASON,
    });
    const rescored = await executeSql(`SELECT winner_player_id FROM match_games WHERE id=$1`, [g1.id]);
    expect(rescored[0].winner_player_id).toBe(g1.away_player_id);

    const operatorConfirm = await executeSql(
      `SELECT is_initiator, reason FROM game_confirmations
       WHERE game_id=$1 AND confirmer_id=$2 AND action='confirm'`,
      [g1.id, operatorId]
    );
    expect(operatorConfirm.length).toBe(1);
    expect(operatorConfirm[0].is_initiator).toBe(true);
    expect(operatorConfirm[0].reason).toBe(CORRECT_REASON);

    // 4. Re-finalize — 8 home / 1 away → still a home win; match re-completes.
    const result = await loFinalizeMatch({ matchId: ids.match, loMemberId: operatorId, winCondition: 'games' });
    expect(result.result).toBe('home_win');

    const final = await executeSql(
      `SELECT status, winner_team_id, home_games_won, away_games_won FROM matches WHERE id=$1`,
      [ids.match]
    );
    expect(final[0].status).toBe('completed'); // re-included in standings
    expect(final[0].winner_team_id).toBe(ids.homeTeam);
    expect(final[0].home_games_won).toBe(8);
    expect(final[0].away_games_won).toBe(1);

    // The seeded team rows STILL survive the whole correction (append-only).
    const seededFinal = await executeSql(
      `SELECT count(*)::int AS n FROM game_confirmations
       WHERE game_id=$1 AND confirmer_id <> $2 AND action='confirm'`,
      [g1.id, operatorId]
    );
    expect(seededFinal[0].n).toBe(2);
  });

  it('restore escape re-stamps the prior completed result without recomputing', async () => {
    // Reopen the now-completed match, then restore (the tie-block recovery path).
    const before = await executeSql(`SELECT winner_team_id FROM matches WHERE id=$1`, [ids.match]);
    await loReopenMatch(ids.match);
    expect(
      (await executeSql(`SELECT status FROM matches WHERE id=$1`, [ids.match]))[0].status
    ).toBe('in_progress');

    await loRestoreCompletion(ids.match);
    const after = await executeSql(
      `SELECT status, winner_team_id FROM matches WHERE id=$1`,
      [ids.match]
    );
    expect(after[0].status).toBe('completed');
    expect(after[0].winner_team_id).toBe(before[0].winner_team_id); // prior winner intact
  });
});
