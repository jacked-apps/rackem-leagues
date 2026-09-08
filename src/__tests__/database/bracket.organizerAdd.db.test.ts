/**
 * @fileoverview DB tests for add_registered_to_hopper (organizer search-add).
 *
 * The load-bearing property is the display name: it must be derived exactly as
 * join_bracket_hopper derives it, so the same player enters under the same name
 * whether they scanned the code or the organizer looked them up. A name may
 * only appear once per tournament, so a mismatch between the two paths would
 * surface as a collision nobody could account for.
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('add_registered_to_hopper', () => {
  let organizerId: string;
  let registeredId: string;
  let registeredName: string;
  const bracketIds: string[] = [];

  async function makeBracket(status = 'setup') {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, status, tier, premium_features)
       VALUES ('Search Add Test', 'single_elimination', $1, $2, 'paid', ARRAY['real_players']::text[])
       RETURNING id`,
      [organizerId, status]
    );
    bracketIds.push(rows[0].id);
    return rows[0].id as string;
  }

  async function add(bracketId: string, memberId: string) {
    const rows = await executeSql(
      `SELECT public.add_registered_to_hopper($1::uuid, $2::uuid) AS r`,
      [bracketId, memberId]
    );
    return rows[0].r as Record<string, unknown>;
  }

  beforeAll(async () => {
    const authed = await executeSql(
      `SELECT id, COALESCE(NULLIF(btrim(nickname), ''),
              NULLIF(btrim(concat_ws(' ', first_name, last_name)), ''), 'Player') AS name
         FROM public.members WHERE user_id IS NOT NULL LIMIT 1`
    );
    if (authed.length < 1) {
      throw new Error('bracket.organizerAdd.db.test needs a member with a user_id.');
    }
    registeredId = authed[0].id;
    registeredName = authed[0].name;

    const other = await executeSql(`SELECT id FROM public.members WHERE id <> $1 LIMIT 1`, [
      registeredId,
    ]);
    organizerId = other[0].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await executeSql(
      `DELETE FROM public.bracket_roster WHERE organizer_member_id = $1 OR player_member_id = $1`,
      [organizerId]
    );
    await closePostgresPool();
  });

  it('adds the player under the name the self-join path would give them', async () => {
    const bracketId = await makeBracket();
    const result = await add(bracketId, registeredId);

    expect(result.ok).toBe(true);
    expect(result.name).toBe(registeredName);

    const rows = await executeSql(
      `SELECT display_name, status, added_via FROM public.bracket_hopper
        WHERE bracket_id = $1 AND member_id = $2`,
      [bracketId, registeredId]
    );
    expect(rows[0].display_name).toBe(registeredName);
    expect(rows[0].status).toBe('hopper'); // waiting, not straight into the tournament
    expect(rows[0].added_via).toBe('search');
  });

  it('treats adding someone twice as a no-op, not a name collision', async () => {
    const bracketId = await makeBracket();
    await add(bracketId, registeredId);

    const second = await add(bracketId, registeredId);
    expect(second.ok).toBe(true);
    expect(second.already_in).toBe(true);
  });

  it('reports a name already taken by someone else', async () => {
    const bracketId = await makeBracket();
    // A walk-up got there first under the same name.
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, added_via)
       VALUES ($1, $2, 'search')`,
      [bracketId, registeredName]
    );

    const result = await add(bracketId, registeredId);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('name_taken');
  });

  it('refuses a placeholder — they belong to a league, not a tournament', async () => {
    const placeholder = await executeSql(
      `SELECT id FROM public.members WHERE user_id IS NULL LIMIT 1`
    );
    if (placeholder.length === 0) return; // no placeholders seeded; nothing to assert

    const bracketId = await makeBracket();
    const result = await add(bracketId, placeholder[0].id);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_registered');
  });

  it('refuses once the tournament has started', async () => {
    const bracketId = await makeBracket('live');
    const result = await add(bracketId, registeredId);
    expect(result.reason).toBe('not_accepting');
  });

  it('reports an unknown tournament rather than erroring', async () => {
    const result = await add('00000000-0000-0000-0000-000000000000', registeredId);
    expect(result.reason).toBe('not_found');
  });
});
