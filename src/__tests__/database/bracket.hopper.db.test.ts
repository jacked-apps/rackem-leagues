/**
 * @fileoverview DB tests for the hopper + roster schema (Unit C1).
 *
 * Verifies the staging model: a registered player admitted (hopper→official)
 * auto-creates a sticky roster entry (organizer→player) via the trigger; ejecting
 * (deleting) the hopper row leaves the roster intact; one registered identity per
 * bracket (UNIQUE), while multiple walk-ups (member_id NULL) are allowed; and a
 * walk-up admission does NOT create a roster row (roster is registered-only).
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('bracket hopper + roster (Unit C1)', () => {
  let organizerId: string; // bracket.created_by
  let playerId: string; // a registered player
  const bracketIds: string[] = [];

  /** A paid bracket owned by the organizer. */
  async function makeBracket(): Promise<string> {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, tier, premium_features)
       VALUES ('Hopper Test', 'single_elimination', $1, 'paid', ARRAY['real_players']::text[])
       RETURNING id`,
      [organizerId]
    );
    bracketIds.push(rows[0].id);
    return rows[0].id;
  }

  beforeAll(async () => {
    const members = await executeSql(`SELECT id FROM public.members LIMIT 2`);
    if (members.length < 2) {
      throw new Error('bracket.hopper.db.test needs at least 2 member rows in the seed.');
    }
    organizerId = members[0].id;
    playerId = members[1].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      // Cascades the hopper rows.
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    // Roster isn't bracket-scoped — clean the specific pair we created.
    await executeSql(
      `DELETE FROM public.bracket_roster WHERE organizer_member_id = $1 AND player_member_id = $2`,
      [organizerId, playerId]
    );
    await closePostgresPool();
  });

  async function rosterCount(): Promise<number> {
    const rows = await executeSql(
      `SELECT count(*)::int AS n FROM public.bracket_roster
        WHERE organizer_member_id = $1 AND player_member_id = $2`,
      [organizerId, playerId]
    );
    return rows[0].n;
  }

  it('admitting a registered player (hopper→official) adds them to the sticky roster', async () => {
    const bracketId = await makeBracket();
    const hop = await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, member_id, display_name, status, added_via)
       VALUES ($1, $2, 'Alice', 'hopper', 'search') RETURNING id`,
      [bracketId, playerId]
    );
    expect(await rosterCount()).toBe(0); // still a candidate, not on the roster yet

    await executeSql(
      `UPDATE public.bracket_hopper SET status = 'official', seed = 1 WHERE id = $1`,
      [hop[0].id]
    );
    expect(await rosterCount()).toBe(1); // admitted → on the roster
  });

  it('ejecting an official player leaves the roster row intact (sticky)', async () => {
    const bracketId = await makeBracket();
    const hop = await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, member_id, display_name, status, added_via)
       VALUES ($1, $2, 'Alice', 'official', 'search') RETURNING id`,
      [bracketId, playerId]
    );
    expect(await rosterCount()).toBeGreaterThanOrEqual(1);

    await executeSql(`DELETE FROM public.bracket_hopper WHERE id = $1`, [hop[0].id]);
    expect(await rosterCount()).toBeGreaterThanOrEqual(1); // roster survives the eject
  });

  it('the same registered player cannot be added to one bracket twice (UNIQUE)', async () => {
    const bracketId = await makeBracket();
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, member_id, display_name, added_via)
       VALUES ($1, $2, 'Alice', 'search')`,
      [bracketId, playerId]
    );
    await expect(
      executeSql(
        `INSERT INTO public.bracket_hopper (bracket_id, member_id, display_name, added_via)
         VALUES ($1, $2, 'Alice again', 'search')`,
        [bracketId, playerId]
      )
    ).rejects.toThrow();
  });

  it('multiple walk-ups (member_id NULL) are allowed in one bracket', async () => {
    const bracketId = await makeBracket();
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, added_via)
       VALUES ($1, 'Walk-up One', 'search')`,
      [bracketId]
    );
    const second = await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, added_via)
       VALUES ($1, 'Walk-up Two', 'search') RETURNING id`,
      [bracketId]
    );
    expect(second[0].id).toBeTruthy();
  });

  it('get_bracket_hopper returns candidates with member fields (registered) / nulls (walk-up)', async () => {
    const bracketId = await makeBracket();
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, member_id, display_name, added_via)
       VALUES ($1, $2, 'Alice', 'search')`,
      [bracketId, playerId]
    );
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, added_via)
       VALUES ($1, 'Walk-up', 'search')`,
      [bracketId]
    );

    const rows = await executeSql(`SELECT public.get_bracket_hopper($1) AS hopper`, [bracketId]);
    const hopper = rows[0].hopper as Array<Record<string, unknown>>;
    expect(Array.isArray(hopper)).toBe(true);
    expect(hopper.length).toBe(2);

    const registered = hopper.find((h) => h.member_id === playerId)!;
    const walkup = hopper.find((h) => h.member_id === null)!;
    expect(registered.display_name).toBe('Alice');
    expect(registered.system_player_number).not.toBeNull(); // member field joined
    expect(walkup.display_name).toBe('Walk-up');
    expect(walkup.nickname).toBeNull(); // no member joined for a walk-up
  });

  it('admitting a walk-up does NOT create a roster row (registered-only)', async () => {
    const bracketId = await makeBracket();
    const before = await executeSql(
      `SELECT count(*)::int AS n FROM public.bracket_roster WHERE organizer_member_id = $1`,
      [organizerId]
    );
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, status, added_via)
       VALUES ($1, 'Walk-up Official', 'official', 'search')`,
      [bracketId]
    );
    const after = await executeSql(
      `SELECT count(*)::int AS n FROM public.bracket_roster WHERE organizer_member_id = $1`,
      [organizerId]
    );
    expect(after[0].n).toBe(before[0].n); // no new roster row for a walk-up
  });
});
