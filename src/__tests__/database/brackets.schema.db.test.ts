/**
 * @fileoverview Schema tests for the tournament bracket tables (`brackets`,
 * `bracket_participants`, `bracket_matches`) — Free Tier v1, Unit 1.
 *
 * Verifies the three tables exist with the right shape/constraints, that child
 * rows CASCADE when a bracket is deleted (the close/sweep path leaves no
 * orphans), that CHECK constraints reject bad enum values, that share_token is
 * a unique non-enumerable uuid, and that brackets + bracket_matches are on the
 * realtime publication with REPLICA IDENTITY FULL (so filtered UPDATE events
 * carry bracket_id). Also exercises the public get_bracket_share RPC boundary.
 *
 * Runs in the `db` vitest project (sequential, jsdom) against the local
 * Postgres via the raw `pg` pool — see src/test/dbTestUtils.ts. Raw SQL is used
 * (not supabase-js) so constraint/FK violations surface as clean throws.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('bracket tables schema', () => {
  let memberId: string; // satisfies brackets.created_by FK
  const insertedBracketIds: string[] = []; // cascade-cleaned in afterAll

  /** Create a bracket owned by the seed member; track it for cleanup. */
  async function makeBracket(): Promise<string> {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by)
       VALUES ('Test Bracket', 'single_elimination', $1)
       RETURNING id`,
      [memberId]
    );
    insertedBracketIds.push(rows[0].id);
    return rows[0].id;
  }

  beforeAll(async () => {
    const members = await executeSql(`SELECT id FROM public.members LIMIT 1`);
    if (members.length === 0) {
      throw new Error(
        'brackets.schema.db.test requires at least one member row. Seed the local DB and retry.'
      );
    }
    memberId = members[0].id;
  });

  afterAll(async () => {
    if (insertedBracketIds.length > 0) {
      // Cascade removes participants + matches.
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [
        insertedBracketIds,
      ]);
    }
    await closePostgresPool();
  });

  it('creates a bracket with defaults (status=setup, seeding=seeded, uuid share_token)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by)
       VALUES ('Bar Night', 'double_elimination', $1)
       RETURNING id, status, seeding_mode, grand_final_reset, share_token, last_activity_at, created_at`,
      [memberId]
    );
    expect(rows.length).toBe(1);
    insertedBracketIds.push(rows[0].id);
    expect(rows[0].status).toBe('setup');
    expect(rows[0].seeding_mode).toBe('seeded');
    expect(rows[0].grand_final_reset).toBe(false);
    expect(rows[0].share_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    ); // uuid = non-enumerable
    expect(rows[0].last_activity_at).toBeTruthy();
    expect(rows[0].created_at).toBeTruthy();
  });

  it('cascades: deleting a bracket removes its participants and matches', async () => {
    const bracketId = await makeBracket();
    const p = await executeSql(
      `INSERT INTO public.bracket_participants (bracket_id, display_name, seed)
       VALUES ($1, 'Alice', 1) RETURNING id`,
      [bracketId]
    );
    await executeSql(
      `INSERT INTO public.bracket_matches (bracket_id, round, side, slot, home_participant_id)
       VALUES ($1, 1, 'winners', 0, $2)`,
      [bracketId, p[0].id]
    );

    await executeSql(`DELETE FROM public.brackets WHERE id = $1`, [bracketId]);
    insertedBracketIds.splice(insertedBracketIds.indexOf(bracketId), 1); // already gone

    const parts = await executeSql(
      `SELECT 1 FROM public.bracket_participants WHERE bracket_id = $1`,
      [bracketId]
    );
    const matches = await executeSql(
      `SELECT 1 FROM public.bracket_matches WHERE bracket_id = $1`,
      [bracketId]
    );
    expect(parts.length).toBe(0);
    expect(matches.length).toBe(0);
  });

  it('rejects an invalid format (check constraint)', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.brackets (name, format, created_by)
         VALUES ('Bad', 'round_robin', $1)`,
        [memberId]
      )
    ).rejects.toThrow();
  });

  it('rejects an invalid status (check constraint)', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.brackets (name, format, status, created_by)
         VALUES ('Bad', 'single_elimination', 'archived', $1)`,
        [memberId]
      )
    ).rejects.toThrow();
  });

  it('rejects an invalid match side (check constraint)', async () => {
    const bracketId = await makeBracket();
    await expect(
      executeSql(
        `INSERT INTO public.bracket_matches (bracket_id, round, side, slot)
         VALUES ($1, 1, 'consolation', 0)`,
        [bracketId]
      )
    ).rejects.toThrow();
  });

  it('rejects a duplicate share_token (unique constraint)', async () => {
    const existing = await executeSql(
      `SELECT share_token FROM public.brackets LIMIT 1`
    );
    // Guaranteed a row exists (prior tests created brackets).
    await expect(
      executeSql(
        `INSERT INTO public.brackets (name, format, created_by, share_token)
         VALUES ('Dup', 'single_elimination', $1, $2)`,
        [memberId, existing[0].share_token]
      )
    ).rejects.toThrow();
  });

  it('rejects duplicate seeds within one bracket (unique bracket_id, seed)', async () => {
    const bracketId = await makeBracket();
    await executeSql(
      `INSERT INTO public.bracket_participants (bracket_id, display_name, seed)
       VALUES ($1, 'Alice', 1)`,
      [bracketId]
    );
    await expect(
      executeSql(
        `INSERT INTO public.bracket_participants (bracket_id, display_name, seed)
         VALUES ($1, 'Bob', 1)`,
        [bracketId]
      )
    ).rejects.toThrow();
  });

  it('brackets and bracket_matches are on the supabase_realtime publication', async () => {
    const rows = await executeSql(
      `SELECT tablename FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND tablename IN ('brackets', 'bracket_matches')`
    );
    expect(rows.map((r: { tablename: string }) => r.tablename).sort()).toEqual([
      'bracket_matches',
      'brackets',
    ]);
  });

  it('bracket_matches has REPLICA IDENTITY FULL (so filtered UPDATE events carry bracket_id)', async () => {
    // relreplident: 'f' = FULL, 'd' = default (primary key only).
    const rows = await executeSql(
      `SELECT relreplident FROM pg_class WHERE relname = 'bracket_matches'`
    );
    expect(rows[0].relreplident).toBe('f');
  });

  it('get_bracket_share returns names-only for a valid token and {found:false} for an unknown one', async () => {
    const bracketId = await makeBracket();
    await executeSql(
      `INSERT INTO public.bracket_participants (bracket_id, display_name, seed)
       VALUES ($1, 'Alice', 1), ($1, 'Bob', 2)`,
      [bracketId]
    );
    const tokenRow = await executeSql(
      `SELECT share_token FROM public.brackets WHERE id = $1`,
      [bracketId]
    );

    const found = await executeSql(
      `SELECT public.get_bracket_share($1) AS payload`,
      [tokenRow[0].share_token]
    );
    const payload = found[0].payload;
    expect(payload.found).toBe(true);
    expect(payload.bracket.name).toBe('Test Bracket');
    expect(payload.participants.length).toBe(2);
    // Names-only: the projection must NOT leak created_by / member_id.
    expect(payload.bracket.created_by).toBeUndefined();
    expect(payload.participants[0].member_id).toBeUndefined();
    expect(payload.participants[0].display_name).toBe('Alice');

    const missing = await executeSql(
      `SELECT public.get_bracket_share(gen_random_uuid()) AS payload`
    );
    expect(missing[0].payload.found).toBe(false);
  });
});
