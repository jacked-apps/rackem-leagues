/**
 * @fileoverview DB tests for finalize_bracket_hopper (Unit C3, start-time conversion).
 *
 * This is the seam between "who might play" (the hopper) and "who IS playing"
 * (bracket_participants). It must: convert only the OFFICIAL list, number those
 * seeds contiguously from 1 in arrival order, carry a registered player's
 * member_id and a walk-up's name, carry the organizer's paid call into
 * entry_fee_paid, optionally sweep in the waiting room as unpaid, and refuse to
 * run on a tournament that is too small or already started.
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('finalize_bracket_hopper (Unit C3)', () => {
  let organizerId: string;
  let playerId: string;
  const bracketIds: string[] = [];

  async function makeBracket(): Promise<string> {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, tier, premium_features)
       VALUES ('Finalize Test', 'single_elimination', $1, 'paid', ARRAY['real_players']::text[])
       RETURNING id`,
      [organizerId]
    );
    bracketIds.push(rows[0].id);
    return rows[0].id;
  }

  /**
   * Add a hopper row. `minutesAgo` controls created_at, which is the seed order
   * — without it same-transaction rows all share now() and the ordering under
   * test would be decided by the id tiebreak instead.
   */
  async function addEntry(
    bracketId: string,
    opts: {
      name: string;
      memberId?: string;
      status?: 'hopper' | 'official';
      paidStatus?: 'paid' | 'unpaid';
      minutesAgo?: number;
    }
  ): Promise<string> {
    const rows = await executeSql(
      `INSERT INTO public.bracket_hopper
         (bracket_id, member_id, display_name, status, paid_status, added_via, created_at)
       VALUES ($1, $2, $3, $4, $5, 'search', now() - make_interval(mins => $6))
       RETURNING id`,
      [
        bracketId,
        opts.memberId ?? null,
        opts.name,
        opts.status ?? 'official',
        opts.paidStatus ?? null,
        opts.minutesAgo ?? 0,
      ]
    );
    return rows[0].id;
  }

  async function finalize(bracketId: string, includeWaiting = false): Promise<number> {
    const rows = await executeSql(
      `SELECT public.finalize_bracket_hopper($1, $2) AS n`,
      [bracketId, includeWaiting]
    );
    return rows[0].n;
  }

  async function participants(bracketId: string) {
    return executeSql(
      `SELECT display_name, seed, member_id, entry_fee_paid
         FROM public.bracket_participants
        WHERE bracket_id = $1
        ORDER BY seed`,
      [bracketId]
    );
  }

  beforeAll(async () => {
    const members = await executeSql(`SELECT id FROM public.members LIMIT 2`);
    if (members.length < 2) {
      throw new Error('bracket.finalize.db.test needs at least 2 member rows in the seed.');
    }
    organizerId = members[0].id;
    playerId = members[1].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await executeSql(
      `DELETE FROM public.bracket_roster WHERE organizer_member_id = $1 AND player_member_id = $2`,
      [organizerId, playerId]
    );
    await closePostgresPool();
  });

  it('seeds the official list contiguously in arrival order and carries identity', async () => {
    const bracketId = await makeBracket();
    await addEntry(bracketId, { name: 'First', minutesAgo: 30 });
    await addEntry(bracketId, { name: 'Second', memberId: playerId, minutesAgo: 20 });
    await addEntry(bracketId, { name: 'Third', minutesAgo: 10 });

    expect(await finalize(bracketId)).toBe(3);

    const rows = await participants(bracketId);
    expect(rows.map((r) => r.display_name)).toEqual(['First', 'Second', 'Third']);
    expect(rows.map((r) => r.seed)).toEqual([1, 2, 3]);
    expect(rows[1].member_id).toBe(playerId); // registered player stays linked
    expect(rows[0].member_id).toBeNull(); // walk-up has no account
  });

  it('leaves the waiting room out unless asked', async () => {
    const bracketId = await makeBracket();
    await addEntry(bracketId, { name: 'In One', minutesAgo: 20 });
    await addEntry(bracketId, { name: 'In Two', minutesAgo: 15 });
    await addEntry(bracketId, { name: 'Still Waiting', status: 'hopper', minutesAgo: 5 });

    expect(await finalize(bracketId, false)).toBe(2);

    const rows = await participants(bracketId);
    expect(rows.map((r) => r.display_name)).toEqual(['In One', 'In Two']);
  });

  it('sweeps the waiting room in as UNPAID when asked, seeded after the official list', async () => {
    const bracketId = await makeBracket();
    await addEntry(bracketId, { name: 'In One', paidStatus: 'paid', minutesAgo: 20 });
    await addEntry(bracketId, { name: 'Waiting One', status: 'hopper', minutesAgo: 10 });
    await addEntry(bracketId, { name: 'Waiting Two', status: 'hopper', minutesAgo: 5 });

    expect(await finalize(bracketId, true)).toBe(3);

    const rows = await participants(bracketId);
    expect(rows.map((r) => r.display_name)).toEqual(['In One', 'Waiting One', 'Waiting Two']);
    // The organizer's existing paid call survives; the swept-in players are unpaid.
    expect(rows.map((r) => r.entry_fee_paid)).toEqual([true, false, false]);
  });

  it('records a swept-in registered player on the sticky roster (the trigger still fires)', async () => {
    const bracketId = await makeBracket();
    await executeSql(
      `DELETE FROM public.bracket_roster WHERE organizer_member_id = $1 AND player_member_id = $2`,
      [organizerId, playerId]
    );
    await addEntry(bracketId, { name: 'Official', minutesAgo: 20 });
    await addEntry(bracketId, {
      name: 'Waiting Member',
      memberId: playerId,
      status: 'hopper',
      minutesAgo: 10,
    });

    await finalize(bracketId, true);

    const roster = await executeSql(
      `SELECT count(*)::int AS n FROM public.bracket_roster
        WHERE organizer_member_id = $1 AND player_member_id = $2`,
      [organizerId, playerId]
    );
    expect(roster[0].n).toBe(1);
  });

  it('refuses a tournament with fewer than 2 players', async () => {
    const bracketId = await makeBracket();
    await addEntry(bracketId, { name: 'Lonely' });

    await expect(finalize(bracketId)).rejects.toThrow(/at least 2 players/i);
  });

  it('does not count the waiting room toward the minimum when it is not being added', async () => {
    const bracketId = await makeBracket();
    await addEntry(bracketId, { name: 'Only Official', minutesAgo: 20 });
    await addEntry(bracketId, { name: 'Waiting', status: 'hopper', minutesAgo: 10 });

    await expect(finalize(bracketId, false)).rejects.toThrow(/at least 2 players/i);
    // ...but including them clears the bar.
    expect(await finalize(bracketId, true)).toBe(2);
  });

  it('refuses to run on a tournament that has already started', async () => {
    const bracketId = await makeBracket();
    await addEntry(bracketId, { name: 'One', minutesAgo: 20 });
    await addEntry(bracketId, { name: 'Two', minutesAgo: 10 });
    await finalize(bracketId);
    await executeSql(`UPDATE public.brackets SET status = 'live' WHERE id = $1`, [bracketId]);

    await expect(finalize(bracketId)).rejects.toThrow(/already been started/i);
  });

  it('replaces rather than appends when run twice during setup', async () => {
    const bracketId = await makeBracket();
    await addEntry(bracketId, { name: 'One', minutesAgo: 20 });
    await addEntry(bracketId, { name: 'Two', minutesAgo: 10 });

    await finalize(bracketId);
    await addEntry(bracketId, { name: 'Three', minutesAgo: 5 });
    expect(await finalize(bracketId)).toBe(3);

    const rows = await participants(bracketId);
    expect(rows.map((r) => r.display_name)).toEqual(['One', 'Two', 'Three']);
    expect(rows.map((r) => r.seed)).toEqual([1, 2, 3]);
  });
});
