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
      `SELECT id, user_id FROM public.members WHERE user_id IS NOT NULL ORDER BY id LIMIT 2`
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

  // --- setting a race up --------------------------------------------------

  it('creates a race with the chosen break rule, game type and a goal each', async () => {
    await inTx(async (c) => {
      await login(c, homeUser);
      const out = await rpc(c, `SELECT create_race($1, $2, 7, 4, 'winner_breaks', 'nine_ball')`, [
        homeMember,
        awayMember,
      ]);
      expect(out.ok).toBe(true);

      const res = await c.query(
        `SELECT goal_home, goal_away, break_rule, game_type, status FROM races WHERE id = $1`,
        [out.race_id]
      );
      expect(res.rows[0]).toMatchObject({
        goal_home: 7,
        goal_away: 4,
        break_rule: 'winner_breaks',
        game_type: 'nine_ball',
        status: 'created',
      });
    });
  });

  it.each([
    ['a goal below 1', `create_race($1, $2, 0, 5, 'alternate', 'eight_ball')`, 'bad_goal'],
    ['an unknown break rule', `create_race($1, $2, 5, 5, 'loser_breaks', 'eight_ball')`, 'bad_break_rule'],
    ['an unknown game type', `create_race($1, $2, 5, 5, 'alternate', 'seven_ball')`, 'bad_game_type'],
  ])('refuses %s', async (_label, call, reason) => {
    await inTx(async (c) => {
      await login(c, homeUser);
      const out = await rpc(c, `SELECT ${call}`, [homeMember, awayMember]);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe(reason);
    });
  });

  it('refuses to set up a race between two other people', async () => {
    await inTx(async (c) => {
      const other = await c.query(
        `SELECT id FROM members WHERE id <> $1 AND id <> $2 LIMIT 1`,
        [homeMember, awayMember]
      );
      await login(c, homeUser);
      const out = await rpc(c, `SELECT create_race($1, $2, 5, 5, 'alternate', 'eight_ball')`, [
        other.rows[0].id,
        awayMember,
      ]);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('not_a_player');
    });
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

  it('passes the break back and forth every game under alternate', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c, { goalHome: 9, goalAway: 9 });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      // Same player wins every game — under alternate that must not matter.
      await playGame(c, raceId, 1, homeMember);
      await playGame(c, raceId, 2, homeMember);
      await playGame(c, raceId, 3, homeMember);

      const g = await games(c, raceId);
      expect(g.map((r) => r.home_action)).toEqual(['breaks', 'racks', 'breaks', 'racks']);
    });
  });

  it('gives the break to whoever won the previous game under winner_breaks', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c, { goalHome: 9, goalAway: 9, breakRule: 'winner_breaks' });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, awayMember); // away wins -> away breaks 2
      await playGame(c, raceId, 2, awayMember); // away again -> away breaks 3
      await playGame(c, raceId, 3, homeMember); // home takes it -> home breaks 4

      const g = await games(c, raceId);
      expect(g.map((r) => r.home_action)).toEqual(['breaks', 'racks', 'racks', 'breaks']);
    });
  });

  it('lets a player correct their own entry before the other has agreed', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await rpc(c, `SELECT record_race_game($1, 1, $2)`, [raceId, homeMember]);
      // Wrong name tapped. Nobody has agreed yet, so this is a retype, not a
      // reversal — needing a vacate here would trap the pair on a typo.
      const out = await rpc(c, `SELECT record_race_game($1, 1, $2)`, [raceId, awayMember]);

      expect(out.ok).toBe(true);
      const g = await games(c, raceId);
      expect(g[0].winner_player_id).toBe(awayMember);
    });
  });

  it('clears the first player’s vouch when the opponent enters a different result', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await rpc(c, `SELECT record_race_game($1, 1, $2)`, [raceId, homeMember]);

      // Away does not agree — instead of confirming, they enter the other
      // result. Home vouched for something else, and that vouch must not
      // silently attach to a result they never saw.
      await login(c, awayUser);
      await rpc(c, `SELECT record_race_game($1, 1, $2)`, [raceId, awayMember]);

      const g = await games(c, raceId);
      expect(g[0].winner_player_id).toBe(awayMember);
      expect(g[0].confirmed_by_home).toBeNull();
      expect(g[0].confirmed_by_away).toBe(awayMember);
      // Both attempts survive in the record — this is the disagreement the
      // many-eyes layer exists to surface, not something to overwrite away.
      const res = await c.query(
        `SELECT count(*)::int AS n FROM race_confirmations
          WHERE race_id = $1 AND game_number = 1 AND action = 'confirm'`,
        [raceId]
      );
      expect(res.rows[0].n).toBe(2);
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

  // --- linear play --------------------------------------------------------

  it('refuses to wipe anything but the last game played', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c, { goalHome: 5, goalAway: 5 });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, homeMember);
      await playGame(c, raceId, 2, awayMember);
      await playGame(c, raceId, 3, homeMember);
      await playGame(c, raceId, 4, awayMember);
      await playGame(c, raceId, 5, homeMember);

      await login(c, homeUser);
      const out = await rpc(c, `SELECT vacate_race_game($1, 3)`, [raceId]);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('not_last_game');
      expect(out.last_game).toBe(5);
    });
  });

  it('fixes game 3 of 5 by reversing 5, then 4, then 3', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c, { goalHome: 5, goalAway: 5 });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, homeMember);
      await playGame(c, raceId, 2, awayMember);
      await playGame(c, raceId, 3, homeMember);
      await playGame(c, raceId, 4, awayMember);
      await playGame(c, raceId, 5, homeMember);

      // Walk back to game 3, one game at a time.
      await login(c, homeUser);
      for (const n of [5, 4, 3]) {
        const out = await rpc(c, `SELECT vacate_race_game($1, $2)`, [raceId, n]);
        expect(out.ok).toBe(true);
      }

      // Game 3 was actually the other player's. Re-score it and play forward.
      await playGame(c, raceId, 3, awayMember);

      const g = await games(c, raceId);
      expect(g[2].winner_player_id).toBe(awayMember);
      // Back to three games played, with game 4 up next — the rows match what
      // actually happened, with nothing stranded above them.
      expect(g.length).toBe(4);
      expect(g[3].winner_player_id).toBeNull();

      const res = await c.query(`SELECT * FROM race_standing($1)`, [raceId]);
      expect(res.rows[0]).toMatchObject({ home_won: 1, away_won: 2, winner_player_id: null });
    });
  });

  it('refuses a result on any game but the next one to be played', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c);
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, homeMember);

      // Game 1 is settled and game 2 is waiting. Changing game 1 means
      // vacating it first, not overwriting it.
      await login(c, homeUser);
      const out = await rpc(c, `SELECT record_race_game($1, 1, $2)`, [raceId, awayMember]);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('not_next_game');
      expect(out.next_game).toBe(2);

      const g = await games(c, raceId);
      expect(g[0].winner_player_id).toBe(homeMember); // untouched
    });
  });

  it('un-finishes, then re-finishes, when the deciding game is re-scored', async () => {
    await inTx(async (c) => {
      const raceId = await makeRace(c, { goalHome: 2, goalAway: 2 });
      await login(c, homeUser);
      await rpc(c, `SELECT start_race($1, 'home')`, [raceId]);
      await playGame(c, raceId, 1, homeMember);
      await playGame(c, raceId, 2, homeMember);
      expect(await raceRow(c, raceId)).toMatchObject({ winner_player_id: homeMember });

      await login(c, awayUser);
      await rpc(c, `SELECT vacate_race_game($1, 2)`, [raceId]);
      expect(await raceRow(c, raceId)).toMatchObject({ status: 'in_play' });

      await playGame(c, raceId, 2, awayMember);
      // 1-1 now, so the race is live again and has grown a game 3.
      expect(await raceRow(c, raceId)).toMatchObject({ status: 'in_play' });
      expect((await games(c, raceId)).length).toBe(3);
    });
  });
});
