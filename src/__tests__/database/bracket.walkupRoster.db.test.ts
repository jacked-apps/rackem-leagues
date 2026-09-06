/**
 * @fileoverview DB tests for the remembered-walk-up roster (Unit C3).
 *
 * A walk-up has no account, so the organizer's "past players" list remembers
 * their NAME — otherwise a regular who never registers gets re-typed every week.
 * Verifies the trigger (records on admission only, sticky, case-insensitively
 * unique per organizer) and that get_bracket_roster returns registered players
 * and remembered walk-ups as one list while still excluding anyone already in
 * the bracket's hopper.
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('bracket walk-up roster (Unit C3)', () => {
  let organizerId: string;
  let playerId: string;
  const bracketIds: string[] = [];
  // Distinctive so the assertions can't collide with seed data.
  const WALKUP = 'Rocket McTestface';

  async function makeBracket(): Promise<string> {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, tier, premium_features)
       VALUES ('Walk-up Test', 'single_elimination', $1, 'paid', ARRAY['real_players']::text[])
       RETURNING id`,
      [organizerId]
    );
    bracketIds.push(rows[0].id);
    return rows[0].id;
  }

  async function addWalkup(
    bracketId: string,
    name: string,
    status: 'hopper' | 'official' = 'official'
  ): Promise<string> {
    const rows = await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, status, added_via)
       VALUES ($1, $2, $3, 'search') RETURNING id`,
      [bracketId, name, status]
    );
    return rows[0].id;
  }

  async function rememberedCount(name = WALKUP): Promise<number> {
    const rows = await executeSql(
      `SELECT count(*)::int AS n FROM public.bracket_walkup_roster
        WHERE organizer_member_id = $1 AND lower(btrim(display_name)) = lower(btrim($2))`,
      [organizerId, name]
    );
    return rows[0].n;
  }

  async function pastPlayers(bracketId: string) {
    const rows = await executeSql(`SELECT public.get_bracket_roster($1) AS roster`, [bracketId]);
    return rows[0].roster as Array<Record<string, unknown>>;
  }

  beforeAll(async () => {
    const members = await executeSql(`SELECT id FROM public.members LIMIT 2`);
    if (members.length < 2) {
      throw new Error('bracket.walkupRoster.db.test needs at least 2 member rows in the seed.');
    }
    organizerId = members[0].id;
    playerId = members[1].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await executeSql(
      `DELETE FROM public.bracket_walkup_roster WHERE organizer_member_id = $1`,
      [organizerId]
    );
    await executeSql(
      `DELETE FROM public.bracket_roster WHERE organizer_member_id = $1 AND player_member_id = $2`,
      [organizerId, playerId]
    );
    await closePostgresPool();
  });

  it('remembers a walk-up name when they are admitted', async () => {
    const bracketId = await makeBracket();
    await addWalkup(bracketId, WALKUP, 'official');
    expect(await rememberedCount()).toBe(1);
  });

  it('does NOT remember a walk-up who is only waiting', async () => {
    await executeSql(
      `DELETE FROM public.bracket_walkup_roster WHERE organizer_member_id = $1`,
      [organizerId]
    );
    const bracketId = await makeBracket();
    const entryId = await addWalkup(bracketId, WALKUP, 'hopper');
    expect(await rememberedCount()).toBe(0);

    // ...until the organizer actually adds them.
    await executeSql(`UPDATE public.bracket_hopper SET status = 'official' WHERE id = $1`, [
      entryId,
    ]);
    expect(await rememberedCount()).toBe(1);
  });

  it('treats differently-cased and padded spellings as one regular', async () => {
    const bracketId = await makeBracket();
    await addWalkup(bracketId, WALKUP);
    const other = await makeBracket();
    await addWalkup(other, `  ${WALKUP.toLowerCase()}  `);

    expect(await rememberedCount()).toBe(1);
  });

  it('keeps the remembered name after the walk-up is ejected (sticky)', async () => {
    const bracketId = await makeBracket();
    const entryId = await addWalkup(bracketId, WALKUP);
    expect(await rememberedCount()).toBe(1);

    await executeSql(`DELETE FROM public.bracket_hopper WHERE id = $1`, [entryId]);
    expect(await rememberedCount()).toBe(1);
  });

  it('offers a remembered walk-up on a NEW bracket, with no member id', async () => {
    const first = await makeBracket();
    await addWalkup(first, WALKUP);

    const next = await makeBracket();
    const past = await pastPlayers(next);
    const row = past.find((r) => r.display_name === WALKUP);
    expect(row).toBeTruthy();
    expect(row!.member_id).toBeNull(); // a walk-up never gains an account
  });

  it('drops a remembered walk-up already in this bracket, matched by name', async () => {
    const first = await makeBracket();
    await addWalkup(first, WALKUP);

    const next = await makeBracket();
    expect((await pastPlayers(next)).some((r) => r.display_name === WALKUP)).toBe(true);

    // Added to this bracket under a different casing — still the same person.
    await addWalkup(next, WALKUP.toUpperCase(), 'hopper');
    expect((await pastPlayers(next)).some((r) => r.display_name === WALKUP)).toBe(false);
  });

  it('returns registered players and remembered walk-ups as one list', async () => {
    const first = await makeBracket();
    await addWalkup(first, WALKUP);
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, member_id, display_name, status, added_via)
       VALUES ($1, $2, 'Registered', 'official', 'search')`,
      [first, playerId]
    );

    const next = await makeBracket();
    const past = await pastPlayers(next);
    expect(past.some((r) => r.member_id === playerId)).toBe(true);
    expect(past.some((r) => r.display_name === WALKUP)).toBe(true);
  });
});
