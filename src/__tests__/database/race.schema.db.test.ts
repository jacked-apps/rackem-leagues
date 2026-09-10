/**
 * @fileoverview Schema tests for the race tables (`races`, `race_games`,
 * `race_confirmations`).
 *
 * A race is two players playing games until one reaches their goal. These tests
 * pin down the three things the rest of the design leans on:
 *
 *  1. **The shape is right** — unequal goals (the handicapped case) are as legal
 *     as equal ones, a player cannot race themselves, and a game cannot have both
 *     players breaking.
 *  2. **Games cannot be double-appended** — (race_id, game_number) is unique, so
 *     two phones evaluating the append gate at the same instant cannot both write
 *     game 6. This constraint is the reason the append can be "unlikely to race"
 *     rather than "impossible to race" everywhere else.
 *  3. **The client key cannot write** — tables created in `public` are born
 *     anon-writable here (the baseline grants ALL on new tables by default), so
 *     an unrevoked race table would let the anon key in the client bundle forge a
 *     confirmation or flip a winner directly. This asserts SELECT and nothing
 *     else, TRUNCATE very much included.
 *
 * Also asserts the realtime publication + REPLICA IDENTITY FULL, without which
 * the opponent's phone never learns a game was scored.
 *
 * Runs in the `db` vitest project (sequential, jsdom) against the local Postgres
 * via the raw `pg` pool — see src/test/dbTestUtils.ts. Raw SQL (not supabase-js)
 * so constraint violations surface as clean throws.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('race tables schema', () => {
  let homeId: string;
  let awayId: string;
  const insertedRaceIds: string[] = []; // cascade-cleaned in afterAll

  /** Create a race between the two seed members; track it for cleanup. */
  async function makeRace(goalHome = 5, goalAway = 5): Promise<string> {
    const rows = await executeSql(
      `INSERT INTO public.races (home_member_id, away_member_id, goal_home, goal_away, game_type)
       VALUES ($1, $2, $3, $4, 'eight_ball')
       RETURNING id`,
      [homeId, awayId, goalHome, goalAway]
    );
    insertedRaceIds.push(rows[0].id);
    return rows[0].id;
  }

  beforeAll(async () => {
    const members = await executeSql(`SELECT id FROM public.members LIMIT 2`);
    if (members.length < 2) {
      throw new Error(
        'race.schema.db.test requires at least two member rows. Seed the local DB and retry.'
      );
    }
    homeId = members[0].id;
    awayId = members[1].id;
  });

  afterAll(async () => {
    if (insertedRaceIds.length > 0) {
      await executeSql(`DELETE FROM public.races WHERE id = ANY($1::uuid[])`, [insertedRaceIds]);
    }
    await closePostgresPool();
  });

  // --- shape -------------------------------------------------------------

  it('creates a race with defaults (created, alternate break, no first breaker yet)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.races (home_member_id, away_member_id, goal_home, goal_away, game_type)
       VALUES ($1, $2, 5, 5, 'eight_ball')
       RETURNING id, status, break_rule, first_breaker_side, winner_player_id`,
      [homeId, awayId]
    );
    insertedRaceIds.push(rows[0].id);
    expect(rows[0].status).toBe('created');
    expect(rows[0].break_rule).toBe('alternate');
    // A race opens by naming who breaks — until someone taps, this is unset.
    expect(rows[0].first_breaker_side).toBeNull();
    expect(rows[0].winner_player_id).toBeNull();
  });

  it('accepts unequal goals — the handicapped race is not a special case', async () => {
    const raceId = await makeRace(7, 3);
    const rows = await executeSql(`SELECT goal_home, goal_away FROM public.races WHERE id = $1`, [
      raceId,
    ]);
    expect(rows[0].goal_home).toBe(7);
    expect(rows[0].goal_away).toBe(3);
  });

  it('rejects a player racing themselves', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.races (home_member_id, away_member_id, goal_home, goal_away, game_type)
         VALUES ($1, $1, 5, 5, 'eight_ball')`,
        [homeId]
      )
    ).rejects.toThrow(/races_distinct_players_check/);
  });

  it('rejects a goal below 1 — a race to zero is already over', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.races (home_member_id, away_member_id, goal_home, goal_away, game_type)
         VALUES ($1, $2, 0, 5, 'eight_ball')`,
        [homeId, awayId]
      )
    ).rejects.toThrow(/races_goal_home_check/);
  });

  it('rejects an unknown game type', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.races (home_member_id, away_member_id, goal_home, goal_away, game_type)
         VALUES ($1, $2, 5, 5, 'seven_ball')`,
        [homeId, awayId]
      )
    ).rejects.toThrow(/races_game_type_check/);
  });

  // --- games -------------------------------------------------------------

  it('rejects both players breaking the same game', async () => {
    const raceId = await makeRace();
    await expect(
      executeSql(
        `INSERT INTO public.race_games (race_id, game_number, home_action, away_action, game_type)
         VALUES ($1, 1, 'breaks', 'breaks', 'eight_ball')`,
        [raceId]
      )
    ).rejects.toThrow(/race_games_actions_differ_check/);
  });

  it('rejects a second game with the same number — the double-append guard', async () => {
    const raceId = await makeRace();
    await executeSql(
      `INSERT INTO public.race_games (race_id, game_number, home_action, away_action, game_type)
       VALUES ($1, 6, 'breaks', 'racks', 'eight_ball')`,
      [raceId]
    );
    await expect(
      executeSql(
        `INSERT INTO public.race_games (race_id, game_number, home_action, away_action, game_type)
         VALUES ($1, 6, 'racks', 'breaks', 'eight_ball')`,
        [raceId]
      )
    ).rejects.toThrow(/race_games_race_id_game_number_key/);
  });

  it('rejects break-and-run and golden-break on the same game', async () => {
    const raceId = await makeRace();
    await expect(
      executeSql(
        `INSERT INTO public.race_games
           (race_id, game_number, home_action, away_action, game_type, break_and_run, golden_break)
         VALUES ($1, 1, 'breaks', 'racks', 'eight_ball', true, true)`,
        [raceId]
      )
    ).rejects.toThrow(/race_games_check/);
  });

  it('cascades games and confirmations when the race is deleted', async () => {
    const rows = await executeSql(
      `INSERT INTO public.races (home_member_id, away_member_id, goal_home, goal_away, game_type)
       VALUES ($1, $2, 5, 5, 'eight_ball') RETURNING id`,
      [homeId, awayId]
    );
    const raceId = rows[0].id;
    const gameRows = await executeSql(
      `INSERT INTO public.race_games (race_id, game_number, home_action, away_action, game_type)
       VALUES ($1, 1, 'breaks', 'racks', 'eight_ball') RETURNING id`,
      [raceId]
    );
    await executeSql(
      `INSERT INTO public.race_confirmations (race_id, game_id, game_number, confirmer_id, side)
       VALUES ($1, $2, 1, $3, 'home')`,
      [raceId, gameRows[0].id, homeId]
    );

    await executeSql(`DELETE FROM public.races WHERE id = $1`, [raceId]);

    const games = await executeSql(`SELECT id FROM public.race_games WHERE race_id = $1`, [raceId]);
    const confs = await executeSql(`SELECT id FROM public.race_confirmations WHERE race_id = $1`, [
      raceId,
    ]);
    expect(games.length).toBe(0);
    expect(confs.length).toBe(0);
  });

  // --- confirmations -----------------------------------------------------

  it("rejects a side that is not the literal 'home' or 'away'", async () => {
    const raceId = await makeRace();
    const gameRows = await executeSql(
      `INSERT INTO public.race_games (race_id, game_number, home_action, away_action, game_type)
       VALUES ($1, 1, 'breaks', 'racks', 'eight_ball') RETURNING id`,
      [raceId]
    );
    // deriveDissents SKIPS any other value without throwing, which would
    // disable dissent detection invisibly. The constraint is the only thing
    // that makes that failure loud.
    await expect(
      executeSql(
        `INSERT INTO public.race_confirmations (race_id, game_id, game_number, confirmer_id, side)
         VALUES ($1, $2, 1, $3, $4)`,
        [raceId, gameRows[0].id, homeId, homeId]
      )
    ).rejects.toThrow(/race_confirmations_side_check/);
  });

  // --- privileges --------------------------------------------------------

  it.each(['races', 'race_games', 'race_confirmations'])(
    'grants the client roles SELECT on %s and nothing else',
    async (table) => {
      const rows = await executeSql(
        `SELECT grantee, privilege_type
           FROM information_schema.role_table_grants
          WHERE table_schema = 'public' AND table_name = $1
            AND grantee IN ('anon', 'authenticated')
          ORDER BY grantee, privilege_type`,
        [table]
      );
      // Tables in public are born with GRANT ALL to anon here, so this asserts
      // the revoke actually landed. TRUNCATE matters as much as DELETE: it is
      // one statement that wipes every race.
      const byRole = (role: string) =>
        rows.filter((r) => r.grantee === role).map((r) => r.privilege_type);
      expect(byRole('anon')).toEqual(['SELECT']);
      expect(byRole('authenticated')).toEqual(['SELECT']);
    }
  );

  // --- realtime ----------------------------------------------------------

  it.each(['races', 'race_games', 'race_confirmations'])(
    'publishes %s to supabase_realtime with REPLICA IDENTITY FULL',
    async (table) => {
      const published = await executeSql(
        `SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = $1`,
        [table]
      );
      expect(published.length).toBe(1);

      const identity = await executeSql(
        `SELECT c.relreplident FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = $1`,
        [table]
      );
      // 'f' = FULL. Without it, filtered UPDATE payloads arrive without the
      // columns the room needs to know which race changed.
      expect(identity[0].relreplident).toBe('f');
    }
  );
});
