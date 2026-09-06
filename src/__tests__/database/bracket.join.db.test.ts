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
});
