/**
 * @fileoverview DB tests for the self-add join RPC (Unit C2).
 *
 * `join_bracket_hopper(join_token, via)` lets a signed-in player add THEMSELVES
 * to a paid tournament's hopper by scanning a QR / opening a link. The token
 * encodes only the tournament — the joiner is resolved from auth.uid(), never
 * from the token (PF9/PF24).
 *
 * These tests exercise the auth-independent branch logic (raw pg has no session,
 * so auth.uid() is NULL): an invalid token → not_found; a valid token on a
 * bracket past setup → not_accepting; a valid setup token with no session →
 * not_signed_in (proving anon cannot join). The authed happy path is covered by
 * the mutation wiring + a manual pass.
 *
 * Also covers one-name-per-tournament (first come, first served): the name index
 * decides the race, and the RPC reports `name_taken` rather than leaking a
 * constraint error.
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('join_bracket_hopper (Unit C2)', () => {
  let organizerId: string; // bracket.created_by
  const bracketIds: string[] = [];

  /** A paid bracket owned by the organizer, at the given status. */
  async function makeBracket(status = 'setup'): Promise<{ id: string; joinToken: string }> {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, status, tier, premium_features)
       VALUES ('Join Test', 'single_elimination', $1, $2, 'paid', ARRAY['real_players']::text[])
       RETURNING id, join_token`,
      [organizerId, status]
    );
    bracketIds.push(rows[0].id);
    return { id: rows[0].id, joinToken: rows[0].join_token };
  }

  async function join(joinToken: string): Promise<Record<string, unknown>> {
    const rows = await executeSql(`SELECT public.join_bracket_hopper($1) AS r`, [joinToken]);
    return rows[0].r as Record<string, unknown>;
  }

  beforeAll(async () => {
    const members = await executeSql(`SELECT id FROM public.members LIMIT 1`);
    if (members.length < 1) {
      throw new Error('bracket.join.db.test needs at least 1 member row in the seed.');
    }
    organizerId = members[0].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await closePostgresPool();
  });

  it('rejects an unknown join token with not_found', async () => {
    // A random uuid that matches no bracket.
    const result = await join('00000000-0000-0000-0000-000000000000');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_found');
  });

  it('rejects a valid token once the tournament is past setup (not_accepting)', async () => {
    const { joinToken } = await makeBracket('live');
    const result = await join(joinToken);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_accepting');
    expect(result.status).toBe('live');
  });

  it('rejects an anonymous caller on a valid setup token (not_signed_in)', async () => {
    // Raw pg has no session, so auth.uid() is NULL — proves anon cannot self-add.
    const { joinToken } = await makeBracket('setup');
    const result = await join(joinToken);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_signed_in');
  });

  it('allows a name only once per tournament, first come first served', async () => {
    const { id } = await makeBracket('setup');
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, added_via)
       VALUES ($1, 'Tim P', 'search')`,
      [id]
    );

    // The second entry loses the race, whatever the casing or padding.
    await expect(
      executeSql(
        `INSERT INTO public.bracket_hopper (bracket_id, display_name, added_via)
         VALUES ($1, '  tim p  ', 'search')`,
        [id]
      )
    ).rejects.toThrow();
  });

  it('lets the same name live in DIFFERENT tournaments', async () => {
    const first = await makeBracket('setup');
    const second = await makeBracket('setup');
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, added_via)
       VALUES ($1, 'Tim P', 'search')`,
      [first.id]
    );
    const row = await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, added_via)
       VALUES ($1, 'Tim P', 'search') RETURNING id`,
      [second.id]
    );
    expect(row[0].id).toBeTruthy();
  });

  it('reports name_taken instead of failing on the index', async () => {
    const authed = await executeSql(
      `SELECT id, user_id, COALESCE(NULLIF(btrim(nickname), ''),
              NULLIF(btrim(concat_ws(' ', first_name, last_name)), ''), 'Player') AS name
         FROM public.members WHERE user_id IS NOT NULL LIMIT 1`
    );
    if (authed.length < 1) throw new Error('needs a member with a user_id');

    const { id, joinToken } = await makeBracket('setup');
    // Someone else is already here under the caller's own nickname.
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, added_via)
       VALUES ($1, $2, 'search')`,
      [id, authed[0].name]
    );

    const rows = await executeSql(
      `SELECT public.join_bracket_hopper($1::uuid) AS r
         FROM (SELECT set_config('request.jwt.claim.sub', $2, true)) s`,
      [joinToken, authed[0].user_id]
    );
    const result = rows[0].r as Record<string, unknown>;
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('name_taken');
    expect(result.name).toBe(authed[0].name);
  });

  it('treats a re-scan by someone already in as a no-op, not a taken name', async () => {
    const authed = await executeSql(
      `SELECT id, user_id FROM public.members WHERE user_id IS NOT NULL LIMIT 1`
    );
    const { joinToken } = await makeBracket('setup');

    const join = async () => {
      const rows = await executeSql(
        `SELECT public.join_bracket_hopper($1::uuid) AS r
           FROM (SELECT set_config('request.jwt.claim.sub', $2, true)) s`,
        [joinToken, authed[0].user_id]
      );
      return rows[0].r as Record<string, unknown>;
    };

    expect((await join()).ok).toBe(true);
    // Their own row must not be read as somebody else holding their name.
    const second = await join();
    expect(second.ok).toBe(true);
    expect(second.already_in).toBe(true);
  });
});
