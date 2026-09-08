/**
 * @fileoverview DB tests for forget_bracket_roster_entry (Unit C3 housekeeping).
 *
 * The past-players list is sticky — an eject never removes anyone — so this RPC
 * is the only way out, and it must be narrow: one person at a time, only from
 * the CALLER's own list. The organizer is resolved from auth.uid() rather than
 * passed in, which is the whole safety property while RLS is off.
 *
 * auth.uid() reads `request.jwt.claim.sub`, so each call sets that per-statement
 * (is_local, so nothing leaks to the next test on the pooled connection).
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('forget_bracket_roster_entry (Unit C3)', () => {
  let organizerId: string; // the member whose login we can simulate
  let organizerUid: string; // that member's auth user id
  let otherOrganizerId: string;
  let playerId: string;
  const WALKUP = 'Forgettable McTestface';

  /**
   * Call the RPC as a signed-in organizer. The FROM subquery runs before the
   * SELECT list, so the session claim is in place before the function is called;
   * is_local keeps it scoped to this statement.
   */
  async function forgetAs(
    uid: string,
    target: { memberId?: string; displayName?: string }
  ): Promise<boolean> {
    const rows = await executeSql(
      `SELECT public.forget_bracket_roster_entry($1::uuid, $2::text) AS ok
         FROM (SELECT set_config('request.jwt.claim.sub', $3, true)) s`,
      [target.memberId ?? null, target.displayName ?? null, uid]
    );
    return rows[0].ok;
  }

  async function registeredRows(organizer: string): Promise<number> {
    const rows = await executeSql(
      `SELECT count(*)::int AS n FROM public.bracket_roster
        WHERE organizer_member_id = $1 AND player_member_id = $2`,
      [organizer, playerId]
    );
    return rows[0].n;
  }

  async function walkupRows(organizer: string): Promise<number> {
    const rows = await executeSql(
      `SELECT count(*)::int AS n FROM public.bracket_walkup_roster
        WHERE organizer_member_id = $1 AND lower(btrim(display_name)) = lower($2)`,
      [organizer, WALKUP.toLowerCase()]
    );
    return rows[0].n;
  }

  /** Put both kinds of remembered player on an organizer's list. */
  async function seedRoster(organizer: string): Promise<void> {
    await executeSql(
      `INSERT INTO public.bracket_roster (organizer_member_id, player_member_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [organizer, playerId]
    );
    await executeSql(
      `INSERT INTO public.bracket_walkup_roster (organizer_member_id, display_name)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [organizer, WALKUP]
    );
  }

  beforeAll(async () => {
    const authed = await executeSql(
      `SELECT id, user_id FROM public.members WHERE user_id IS NOT NULL LIMIT 1`
    );
    if (authed.length < 1) {
      throw new Error('bracket.rosterForget.db.test needs a member with a user_id.');
    }
    organizerId = authed[0].id;
    organizerUid = authed[0].user_id;

    const others = await executeSql(`SELECT id FROM public.members WHERE id <> $1 LIMIT 2`, [
      organizerId,
    ]);
    if (others.length < 2) {
      throw new Error('bracket.rosterForget.db.test needs at least 3 member rows.');
    }
    playerId = others[0].id;
    otherOrganizerId = others[1].id;
  });

  afterAll(async () => {
    for (const org of [organizerId, otherOrganizerId]) {
      await executeSql(
        `DELETE FROM public.bracket_roster WHERE organizer_member_id = $1 AND player_member_id = $2`,
        [org, playerId]
      );
      await executeSql(
        `DELETE FROM public.bracket_walkup_roster WHERE organizer_member_id = $1`,
        [org]
      );
    }
    await closePostgresPool();
  });

  it('refuses an anonymous caller', async () => {
    // Raw pg with no claim set — auth.uid() is NULL.
    await expect(
      executeSql(`SELECT public.forget_bracket_roster_entry($1::uuid, NULL) AS ok`, [playerId])
    ).rejects.toThrow(/signed in/i);
  });

  it('removes a registered past player from the caller\'s list', async () => {
    await seedRoster(organizerId);
    expect(await registeredRows(organizerId)).toBe(1);

    expect(await forgetAs(organizerUid, { memberId: playerId })).toBe(true);
    expect(await registeredRows(organizerId)).toBe(0);
  });

  it('removes a remembered walk-up by name, ignoring case', async () => {
    await seedRoster(organizerId);
    expect(await walkupRows(organizerId)).toBe(1);

    expect(await forgetAs(organizerUid, { displayName: WALKUP.toUpperCase() })).toBe(true);
    expect(await walkupRows(organizerId)).toBe(0);
  });

  it('reports false rather than failing when there is nothing to forget', async () => {
    expect(await forgetAs(organizerUid, { displayName: 'Never Existed McTestface' })).toBe(
      false
    );
  });

  it('cannot reach another organizer\'s list', async () => {
    // Clear the CALLER's own rows first — otherwise a `true` here could just
    // mean it deleted their copy, and the test would prove nothing.
    await executeSql(
      `DELETE FROM public.bracket_roster WHERE organizer_member_id = $1 AND player_member_id = $2`,
      [organizerId, playerId]
    );
    await executeSql(
      `DELETE FROM public.bracket_walkup_roster WHERE organizer_member_id = $1`,
      [organizerId]
    );

    await seedRoster(otherOrganizerId);
    expect(await registeredRows(otherOrganizerId)).toBe(1);
    expect(await walkupRows(otherOrganizerId)).toBe(1);

    // The caller has no such rows of their own; the other organizer's must survive.
    expect(await forgetAs(organizerUid, { memberId: playerId })).toBe(false);
    expect(await forgetAs(organizerUid, { displayName: WALKUP })).toBe(false);

    expect(await registeredRows(otherOrganizerId)).toBe(1);
    expect(await walkupRows(otherOrganizerId)).toBe(1);
  });

  it('refuses a call that names nobody', async () => {
    await expect(forgetAs(organizerUid, {})).rejects.toThrow(/nothing to forget/i);
  });
});
