/**
 * @fileoverview DB tests for get_my_tournaments (tournaments I'm playing in).
 *
 * A player who joined by QR had no route back to their tournament from inside
 * the app. This read is that route, so what matters is that it finds them,
 * hands back the join token their view needs, and doesn't leak anyone else's
 * tournaments.
 *
 * auth.uid() reads `request.jwt.claim.sub`, set per-statement (is_local) so
 * nothing leaks to the next test on the pooled connection.
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('get_my_tournaments', () => {
  let playerId: string; // has a user_id, so we can act as them
  let playerUid: string;
  let organizerId: string; // someone else, who runs the tournaments
  const bracketIds: string[] = [];

  async function makeBracket(createdBy: string, name = 'Someone Else Tournament') {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, status, tier, premium_features)
       VALUES ($1, 'single_elimination', $2, 'setup', 'paid', ARRAY['real_players']::text[])
       RETURNING id, join_token`,
      [name, createdBy]
    );
    bracketIds.push(rows[0].id);
    return { id: rows[0].id as string, joinToken: rows[0].join_token as string };
  }

  async function addMe(bracketId: string, status: 'hopper' | 'official') {
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, member_id, display_name, status, added_via)
       VALUES ($1, $2, 'Me', $3, 'qr')`,
      [bracketId, playerId, status]
    );
  }

  async function mine(uid = playerUid) {
    const rows = await executeSql(
      `SELECT public.get_my_tournaments() AS t
         FROM (SELECT set_config('request.jwt.claim.sub', $1, true)) s`,
      [uid]
    );
    return rows[0].t as Array<Record<string, unknown>>;
  }

  beforeAll(async () => {
    const authed = await executeSql(
      `SELECT id, user_id FROM public.members WHERE user_id IS NOT NULL LIMIT 1`
    );
    if (authed.length < 1) {
      throw new Error('bracket.myTournaments.db.test needs a member with a user_id.');
    }
    playerId = authed[0].id;
    playerUid = authed[0].user_id;

    const other = await executeSql(`SELECT id FROM public.members WHERE id <> $1 LIMIT 1`, [
      playerId,
    ]);
    organizerId = other[0].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await executeSql(
      `DELETE FROM public.bracket_roster WHERE organizer_member_id = $1 OR player_member_id = $1`,
      [playerId]
    );
    await closePostgresPool();
  });

  it("finds a tournament I'm in, with the join token my view needs", async () => {
    const { id, joinToken } = await makeBracket(organizerId);
    await addMe(id, 'official');

    const row = (await mine()).find((t) => t.id === id);
    expect(row).toBeTruthy();
    expect(row!.join_token).toBe(joinToken);
    expect(row!.entry_status).toBe('official');
  });

  it('says when I am still only waiting', async () => {
    const { id } = await makeBracket(organizerId);
    await addMe(id, 'hopper');

    const row = (await mine()).find((t) => t.id === id);
    expect(row!.entry_status).toBe('hopper');
  });

  it('leaves out tournaments I am not in', async () => {
    const { id } = await makeBracket(organizerId, 'Not Mine');
    // No hopper row for me at all.
    expect((await mine()).some((t) => t.id === id)).toBe(false);
  });

  it('leaves out tournaments I created — the page lists those separately', async () => {
    const { id } = await makeBracket(playerId, 'My Own Tournament');
    await addMe(id, 'official');

    expect((await mine()).some((t) => t.id === id)).toBe(false);
  });

  it('leaves out closed tournaments', async () => {
    const { id } = await makeBracket(organizerId);
    await addMe(id, 'official');
    await executeSql(`UPDATE public.brackets SET status = 'closed' WHERE id = $1`, [id]);

    expect((await mine()).some((t) => t.id === id)).toBe(false);
  });

  it('keeps listing a tournament after it starts, so I can still get back to it', async () => {
    const { id } = await makeBracket(organizerId);
    await addMe(id, 'official');
    await executeSql(`UPDATE public.brackets SET status = 'live' WHERE id = $1`, [id]);

    const row = (await mine()).find((t) => t.id === id);
    expect(row).toBeTruthy();
    expect(row!.status).toBe('live');
  });

  it('gives an anonymous caller nothing rather than erroring', async () => {
    const rows = await executeSql(`SELECT public.get_my_tournaments() AS t`);
    expect(rows[0].t).toEqual([]);
  });
});
