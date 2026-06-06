/**
 * @fileoverview Schema tests for the `game_confirmations` table (live-scoring
 * Layer-2 "many-eyes").
 *
 * Verifies the append-only witness table exists with the right shape and
 * constraints, is on the realtime publication, and is PURELY ADDITIVE — the
 * `match_games` officiality columns it relies on are untouched. These pin the
 * keystone decision: officiality stays on `match_games.confirmed_by_*`, this
 * table only records who vouched for what.
 *
 * Runs in the `db` vitest project (sequential, jsdom) against the local
 * Postgres via the raw `pg` pool — see src/test/dbTestUtils.ts. Raw SQL is used
 * (not supabase-js) so constraint/FK violations surface as clean throws.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('game_confirmations schema', () => {
  // Real seed rows to satisfy the FKs on valid inserts.
  let matchId: string;
  let gameId: string;
  let gameNumber: number;
  let confirmerId: string;
  let winnerTeamId: string | null;

  // Track rows we insert so we can clean them up (dev data is disposable, but
  // tidy tests don't leave residue for the next run).
  const insertedIds: string[] = [];

  beforeAll(async () => {
    const games = await executeSql(
      `SELECT id, match_id, game_number, winner_team_id
         FROM public.match_games
         LIMIT 1`
    );
    const members = await executeSql(`SELECT id FROM public.members LIMIT 1`);

    if (games.length === 0 || members.length === 0) {
      throw new Error(
        'game_confirmations.schema.db.test requires seed data (at least one match_games row and one member). Seed the local DB and retry.'
      );
    }

    matchId = games[0].match_id;
    gameId = games[0].id;
    gameNumber = games[0].game_number;
    winnerTeamId = games[0].winner_team_id;
    confirmerId = members[0].id;
  });

  afterAll(async () => {
    if (insertedIds.length > 0) {
      await executeSql(
        `DELETE FROM public.game_confirmations WHERE id = ANY($1::uuid[])`,
        [insertedIds]
      );
    }
    await closePostgresPool();
  });

  it('exists and is on the supabase_realtime publication', async () => {
    const rows = await executeSql(
      `SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND tablename = 'game_confirmations'`
    );
    expect(rows.length).toBe(1);
  });

  it('inserts a full vouch row and defaults action=confirm + created_at', async () => {
    const rows = await executeSql(
      `INSERT INTO public.game_confirmations
         (match_id, game_id, game_number, confirmer_id, side,
          winner_team_id, winner_player_id,
          break_and_run, golden_break, break_fouled, runout, win_by_forfeit,
          winner_value, loser_value)
       VALUES ($1, $2, $3, $4, 'home',
               $5, NULL,
               true, false, false, false, false,
               7, 3)
       RETURNING id, action, created_at`,
      [matchId, gameId, gameNumber, confirmerId, winnerTeamId]
    );
    expect(rows.length).toBe(1);
    insertedIds.push(rows[0].id);
    expect(rows[0].action).toBe('confirm'); // column default
    expect(rows[0].created_at).toBeTruthy(); // now() default
  });

  it("accepts action='vacate' (the marker row)", async () => {
    const rows = await executeSql(
      `INSERT INTO public.game_confirmations
         (match_id, game_id, game_number, confirmer_id, side, action)
       VALUES ($1, $2, $3, $4, 'away', 'vacate')
       RETURNING id`,
      [matchId, gameId, gameNumber, confirmerId]
    );
    expect(rows.length).toBe(1);
    insertedIds.push(rows[0].id);
  });

  it('rejects an invalid side (check constraint)', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.game_confirmations
           (match_id, game_id, game_number, confirmer_id, side)
         VALUES ($1, $2, $3, $4, 'middle')`,
        [matchId, gameId, gameNumber, confirmerId]
      )
    ).rejects.toThrow();
  });

  it('rejects an invalid action (check constraint)', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.game_confirmations
           (match_id, game_id, game_number, confirmer_id, side, action)
         VALUES ($1, $2, $3, $4, 'home', 'bogus')`,
        [matchId, gameId, gameNumber, confirmerId]
      )
    ).rejects.toThrow();
  });

  it('rejects a non-existent game_id (FK to match_games)', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.game_confirmations
           (match_id, game_id, game_number, confirmer_id, side)
         VALUES ($1, gen_random_uuid(), $2, $3, 'home')`,
        [matchId, gameNumber, confirmerId]
      )
    ).rejects.toThrow();
  });

  it('rejects a non-existent confirmer_id (FK to members)', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.game_confirmations
           (match_id, game_id, game_number, confirmer_id, side)
         VALUES ($1, $2, $3, gen_random_uuid(), 'home')`,
        [matchId, gameId, gameNumber]
      )
    ).rejects.toThrow();
  });

  it('allows a snapshot winner_team_id with NO matching team (snapshot columns are FK-free, history must not mutate on team delete)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.game_confirmations
         (match_id, game_id, game_number, confirmer_id, side, winner_team_id)
       VALUES ($1, $2, $3, $4, 'home', gen_random_uuid())
       RETURNING id`,
      [matchId, gameId, gameNumber, confirmerId]
    );
    expect(rows.length).toBe(1);
    insertedIds.push(rows[0].id);
  });

  it('leaves match_games officiality columns intact (purely additive change)', async () => {
    const cols = await executeSql(
      `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'match_games'
           AND column_name IN ('confirmed_by_home', 'confirmed_by_away')`
    );
    expect(cols.length).toBe(2);
  });

  // ── Amendment A: is_initiator column ──────────────────────────────────────

  it('has the is_initiator column with default false', async () => {
    const rows = await executeSql(
      `SELECT column_default, is_nullable, data_type
         FROM information_schema.columns
         WHERE table_name = 'game_confirmations' AND column_name = 'is_initiator'`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].data_type).toBe('boolean');
    expect(rows[0].is_nullable).toBe('NO');
    expect(rows[0].column_default).toBe('false');
  });

  it('inserts default the is_initiator column to false (confirmer semantics)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.game_confirmations
         (match_id, game_id, game_number, confirmer_id, side)
       VALUES ($1, $2, $3, $4, 'home')
       RETURNING id, is_initiator`,
      [matchId, gameId, gameNumber, confirmerId]
    );
    expect(rows.length).toBe(1);
    insertedIds.push(rows[0].id);
    expect(rows[0].is_initiator).toBe(false);
  });

  it('accepts is_initiator=true (initiator semantics)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.game_confirmations
         (match_id, game_id, game_number, confirmer_id, side, is_initiator)
       VALUES ($1, $2, $3, $4, 'home', true)
       RETURNING id, is_initiator`,
      [matchId, gameId, gameNumber, confirmerId]
    );
    expect(rows.length).toBe(1);
    insertedIds.push(rows[0].id);
    expect(rows[0].is_initiator).toBe(true);
  });

  it('allows MULTIPLE is_initiator=true rows per (game_id, side) — no unique constraint', async () => {
    // The whole point of the model: two independent fills that agree are the
    // strongest confirmation possible. If they disagree, the dispute path
    // surfaces it — but the row insertion is never blocked by the schema.
    const a = await executeSql(
      `INSERT INTO public.game_confirmations
         (match_id, game_id, game_number, confirmer_id, side, is_initiator)
       VALUES ($1, $2, $3, $4, 'home', true)
       RETURNING id`,
      [matchId, gameId, gameNumber, confirmerId]
    );
    insertedIds.push(a[0].id);

    // Same (game_id, side) + is_initiator=true should NOT error.
    const b = await executeSql(
      `INSERT INTO public.game_confirmations
         (match_id, game_id, game_number, confirmer_id, side, is_initiator)
       VALUES ($1, $2, $3, $4, 'home', true)
       RETURNING id`,
      [matchId, gameId, gameNumber, confirmerId]
    );
    insertedIds.push(b[0].id);
    expect(b.length).toBe(1);
  });

  // ── auto_confirmed column (scoring participation modes) ───────────────────

  it('has the auto_confirmed column with default false', async () => {
    const rows = await executeSql(
      `SELECT column_default, is_nullable, data_type
         FROM information_schema.columns
         WHERE table_name = 'game_confirmations' AND column_name = 'auto_confirmed'`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].data_type).toBe('boolean');
    expect(rows[0].is_nullable).toBe('NO');
    expect(rows[0].column_default).toBe('false');
  });

  it('defaults auto_confirmed to false (a vouch is manual unless flagged)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.game_confirmations
         (match_id, game_id, game_number, confirmer_id, side)
       VALUES ($1, $2, $3, $4, 'home')
       RETURNING id, auto_confirmed`,
      [matchId, gameId, gameNumber, confirmerId]
    );
    expect(rows.length).toBe(1);
    insertedIds.push(rows[0].id);
    expect(rows[0].auto_confirmed).toBe(false);
  });

  it('accepts auto_confirmed=true (Auto-Confirm mode produced this vouch)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.game_confirmations
         (match_id, game_id, game_number, confirmer_id, side, auto_confirmed)
       VALUES ($1, $2, $3, $4, 'home', true)
       RETURNING id, auto_confirmed`,
      [matchId, gameId, gameNumber, confirmerId]
    );
    expect(rows.length).toBe(1);
    insertedIds.push(rows[0].id);
    expect(rows[0].auto_confirmed).toBe(true);
  });
});
