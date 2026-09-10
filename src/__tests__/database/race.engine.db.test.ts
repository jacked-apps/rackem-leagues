/**
 * @fileoverview DB tests for the race engine —
 * supabase/migrations/20260910181344_race_engine.sql
 *
 * Exercises the four things a race can have done to it (start / record /
 * confirm / vacate) plus the two rules that are easy to get wrong and expensive
 * to get wrong late:
 *
 *  - **A new game is born only on the second confirmation.** One player's word
 *    changes nothing; the game becomes official when both agree, and only then
 *    does the next game exist. A game that was never played is never a row.
 *  - **"First to reach their goal in game order" is not "has enough wins."**
 *    Re-scoring a vacated middle game can push someone to their number at an
 *    earlier game while later games still exist. The last test walks exactly
 *    that, because it is the one place a naive count gives the wrong winner.
 *
 * Each case runs in its own transaction with a simulated JWT and ROLLBACKs, so
 * nothing leaks onto the shared local DB and the cases stay independent.
 *
 * Run: pnpm test:run --project db src/__tests__/database/race.engine
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeSql, getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';
import type { PoolClient } from 'pg';
import { afterAll } from 'vitest';

/** Two members that have real logins, so get_current_member_id() resolves. */
let homeMember: string, homeUser: string, awayMember: string, awayUser: string;

async function inTx(fn: (c: PoolClient) => Promise<void>): Promise<void> {
  const c = await getPostgresPool().connect();
  try {
    await c.query('BEGIN');
    await fn(c);
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }
}

/** Set auth.uid() for the rest of this transaction. */
async function login(c: PoolClient, userId: string): Promise<void> {
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId }),
  ]);
}

async function makeRace(
  c: PoolClient,
  opts: { goalHome?: number; goalAway?: number; breakRule?: string } = {}
): Promise<string> {
  const res = await c.query(
    `INSERT INTO races (home_member_id, away_member_id, goal_home, goal_away, game_type, break_rule)
     VALUES ($1, $2, $3, $4, 'eight_ball', $5) RETURNING id`,
    [homeMember, awayMember, opts.goalHome ?? 5, opts.goalAway ?? 5, opts.breakRule ?? 'alternate']
  );
  return res.rows[0].id;
}

async function rpc(c: PoolClient, sql: string, params: unknown[]): Promise<Record<string, unknown>> {
  const res = await c.query(sql, params);
  return res.rows[0][Object.keys(res.rows[0])[0]] as Record<string, unknown>;
}

/** Score game `n` for `winner`, then have the other side confirm it. */
async function playGame(c: PoolClient, raceId: string, n: number, winner: string): Promise<void> {
  const scorerUser = winner === homeMember ? homeUser : awayUser;
  const otherUser = winner === homeMember ? awayUser : homeUser;
  await login(c, scorerUser);
  await rpc(c, `SELECT record_race_game($1, $2, $3)`, [raceId, n, winner]);
  await login(c, otherUser);
  await rpc(c, `SELECT confirm_race_game($1, $2)`, [raceId, n]);
}

async function games(c: PoolClient, raceId: string) {
  const res = await c.query(
    `SELECT game_number, home_action, away_action, winner_player_id,
            confirmed_by_home, confirmed_by_away
       FROM race_games WHERE race_id = $1 ORDER BY game_number`,
    [raceId]
  );
  return res.rows;
}

async function raceRow(c: PoolClient, raceId: string) {
  const res = await c.query(`SELECT status, winner_player_id FROM races WHERE id = $1`, [raceId]);
  return res.rows[0];
}

describe('race engine', () => {
  beforeAll(async () => {
    const rows = await executeSql(
      `SELECT id, user_id FROM public.members WHERE user_id IS NOT NULL LIMIT 2`
    );
    if (rows.length < 2) {
      throw new Error(
        'race.engine.db.test needs two members with linked logins. Seed the local DB and retry.'
      );
    }
    homeMember = rows[0].id;
    homeUser = rows[0].user_id;
    awayMember = rows[1].id;
    awayUser = rows[1].user_id;
  });

  afterAll(async () => {
    await closePostgresPool();
  });

  // --- starting -----------------------------------------------------------

  it('opens a race by naming who breaks, and writes game 1', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      const out = await rpc(c, `SELECT start_race($1, 'away')`, [raceId]);
      expect(out.ok).toBe(true);

      expect(await raceRow(c, raceId)).toMatchObject({ status: 'in_play' });
      const g = await games(c, raceId);
      expect(g.length).toBe(1);
      expect(g[0]).toMatchObject({ game_number: 1, home_action: 'racks', away_action: 'breaks' });
    });
  });

  it('is idempotent when the second phone also taps start', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await login(c, awayUser);
      const out = await rpc(c, `SELECT start_race($1, 'away')`, [raceId]);

      expect(out.ok).toBe(true);
      expect(out.reason).toBe('already_started');
      // The second tap must not have flipped the break or duplicated game 1.
      const g = await games(c, raceId);
      expect(g.length).toBe(1);
      expect(g[0].home_action).toBe('breaks');
    });
  });

  it('refuses someone who is not in the race', async () => {
    await inTx(async (c) => {
      // A race between two other people — the caller is a stranger to it.
      const res = await c.query(
        `INSERT INTO races (home_member_id, away_member_id, goal_home, goal_away, game_type)
         SELECT id, $1, 5, 5, 'eight_ball' FROM members WHERE id <> $1 AND id <> $2 LIMIT 1
         RETURNING id`,
        [awayMember, homeMember]
      );
      await login(c, homeUser);
      const out = await rpc(c, `SELECT start_race($1, 'home')`, [res.rows[0].id]);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('not_in_race');
    });
  });

  // --- one voice is not enough -------------------------------------------

  it('does not make a game official, or grow the race, on one player’s word', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await rpc(c, `SELECT record_race_game($1, 1, $2)`, [raceId, homeMember]);

      const g = await games(c, raceId);
      expect(g.length).toBe(1); // no game 2 yet
      expect(g[0].confirmed_by_home).toBe(homeMember);
      expect(g[0].confirmed_by_away).toBeNull();
    });
  });

  it('grows the next game when the second player confirms', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, homeMember);

      const g = await games(c, raceId);
      expect(g.length).toBe(2);
      // alternate: home broke game 1, so away breaks game 2
      expect(g[1]).toMatchObject({ game_number: 2, home_action: 'racks', away_action: 'breaks' });
    });
  });

  it('gives the break to the previous winner under winner_breaks', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c, { breakRule: 'winner_breaks' });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, awayMember); // away wins game 1

      const g = await games(c, raceId);
      expect(g[1]).toMatchObject({ game_number: 2, away_action: 'breaks', home_action: 'racks' });
    });
  });

  it('clears the opponent’s confirmation when the result is changed', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await rpc(c, `SELECT record_race_game($1, 1, $2)`, [raceId, homeMember]);
      await login(c, awayUser);
      await rpc(c, `SELECT confirm_race_game($1, 1)`, [raceId]);

      // Home changes their mind about who won.
      await login(c, homeUser);
      await rpc(c, `SELECT record_race_game($1, 1, $2)`, [raceId, awayMember]);

      const g = await games(c, raceId);
      // Away agreed to the OLD result; that agreement must not carry over.
      expect(g[0].confirmed_by_away).toBeNull();
      expect(g[0].confirmed_by_home).toBe(homeMember);
    });
  });

  it('treats a repeated confirm as a no-op', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await rpc(c, `SELECT record_race_game($1, 1, $2)`, [raceId, homeMember]);
      await login(c, awayUser);
      await rpc(c, `SELECT confirm_race_game($1, 1)`, [raceId]);
      const out = await rpc(c, `SELECT confirm_race_game($1, 1)`, [raceId]);

      expect(out.reason).toBe('already_confirmed');
      const res = await c.query(
        `SELECT count(*)::int AS n FROM race_confirmations
          WHERE race_id = $1 AND game_number = 1 AND side = 'away' AND action = 'confirm'`,
        [raceId]
      );
      expect(res.rows[0].n).toBe(1);
    });
  });

  // --- finishing ----------------------------------------------------------

  it('finishes when a side reaches its goal, and stops growing', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c, { goalHome: 2, goalAway: 2 });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, homeMember);
      await playGame(c, raceId, 2, homeMember);

      expect(await raceRow(c, raceId)).toMatchObject({
        status: 'finished',
        winner_player_id: homeMember,
      });
      expect((await games(c, raceId)).length).toBe(2); // no game 3
    });
  });

  it('lets the shorter side get there first when the goals are unequal', async () => {
    await inTx(async (c) => {
      // Away is racing to 2, home to 5 — the handicapped case.
      const raceId = await makeRace(c, { goalHome: 5, goalAway: 2 });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, awayMember);
      await playGame(c, raceId, 2, homeMember);
      await playGame(c, raceId, 3, awayMember);

      expect(await raceRow(c, raceId)).toMatchObject({
        status: 'finished',
        winner_player_id: awayMember,
      });
    });
  });

  // --- vacating -----------------------------------------------------------

  it('un-finishes the race when the deciding game is wiped', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c, { goalHome: 2, goalAway: 2 });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, homeMember);
      await playGame(c, raceId, 2, homeMember);
      expect(await raceRow(c, raceId)).toMatchObject({ status: 'finished' });

      await login(c, awayUser);
      const out = await rpc(c, `SELECT vacate_race_game($1, 2)`, [raceId]);
      expect(out.ok).toBe(true);

      expect(await raceRow(c, raceId)).toMatchObject({
        status: 'in_play',
        winner_player_id: null,
      });
      const g = await games(c, raceId);
      expect(g.length).toBe(2); // the game stays, emptied — not deleted
      expect(g[1].winner_player_id).toBeNull();
      expect(g[1].confirmed_by_home).toBeNull();
    });
  });

  it('records a vacate marker carrying the result it wiped', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, homeMember);
      await login(c, homeUser);
      await rpc(c, `SELECT vacate_race_game($1, 1)`, [raceId]);

      const res = await c.query(
        `SELECT winner_player_id FROM race_confirmations
          WHERE race_id = $1 AND game_number = 1 AND action = 'vacate'`,
        [raceId]
      );
      // Dissent detection scopes vouches to the current result using this
      // marker, so it has to carry what was wiped.
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].winner_player_id).toBe(homeMember);
    });
  });

  // --- who may call what --------------------------------------------------

  it.each(['start_race', 'record_race_game', 'confirm_race_game', 'vacate_race_game'])(
    'keeps %s off the anon key that ships in the client bundle',
    async (fn) => {
      const rows = await executeSql(
        `SELECT coalesce(array_to_string(p.proacl::text[], ','), 'DEFAULT') AS acl
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1`,
        [fn]
      );
      // Two separate default grants have to be revoked to get here: PUBLIC's
      // (from CREATE FUNCTION) and anon's (from this database's default
      // privileges). Missing either one exposes the function to the browser.
      expect(rows[0].acl).not.toMatch(/(^|,)=X\//); // PUBLIC
      expect(rows[0].acl).not.toMatch(/anon=X/);
      expect(rows[0].acl).toMatch(/authenticated=X/);
    }
  );

  it('keeps race_advance unreachable from any client role', async () => {
    const rows = await executeSql(
      `SELECT coalesce(array_to_string(p.proacl::text[], ','), 'DEFAULT') AS acl
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'race_advance'`
    );
    // It is the one function here that never asks who is calling — it is only
    // ever meant to run inside the four above, under their lock. SECURITY
    // DEFINER is what lets them still reach it.
    expect(rows[0].acl).not.toMatch(/(^|,)=X\//);
    expect(rows[0].acl).not.toMatch(/anon=X/);
    expect(rows[0].acl).not.toMatch(/authenticated=X/);
  });

  // --- the subtle one -----------------------------------------------------

  it('names whoever reached their goal FIRST in game order, not whoever has the wins', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c, { goalHome: 3, goalAway: 3 });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);

      // home, home, away, away, away — away gets there at game 5.
      await playGame(c, raceId, 1, homeMember);
      await playGame(c, raceId, 2, homeMember);
      await playGame(c, raceId, 3, awayMember);
      await playGame(c, raceId, 4, awayMember);
      await playGame(c, raceId, 5, awayMember);
      expect(await raceRow(c, raceId)).toMatchObject({ winner_player_id: awayMember });

      // Game 3 was wrong. Wipe it and re-score it to home.
      await login(c, homeUser);
      await rpc(c, `SELECT vacate_race_game($1, 3)`, [raceId]);
      await playGame(c, raceId, 3, homeMember);

      // Home now has games 1, 2, 3 — they reached 3 at game 3, before away's
      // wins in games 4 and 5 happened. A naive count would say 3-2 to home
      // and pick the right winner for the wrong reason; the announced score
      // excludes everything after the deciding game.
      expect(await raceRow(c, raceId)).toMatchObject({
        status: 'finished',
        winner_player_id: homeMember,
      });
      const res = await c.query(`SELECT * FROM race_standing($1)`, [raceId]);
      expect(res.rows[0]).toMatchObject({
        home_won: 3,
        away_won: 0,
        winner_player_id: homeMember,
        decided_at_game: 3,
      });
      // The games after it are still there — they really were played.
      expect((await games(c, raceId)).length).toBe(5);
    });
  });
});
