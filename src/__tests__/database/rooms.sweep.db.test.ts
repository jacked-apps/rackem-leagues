/**
 * @fileoverview Idle-sweep tests for the Game Room (Unit 2).
 *
 * `sweep_stale_rooms(p_idle_hours)` deletes rooms whose `last_activity_at` is
 * older than the window and returns the count; phones and game-table rows go
 * with them by cascade. Keyed on state, so it is idempotent and self-healing.
 *
 * Raw pg drives the function directly (it is revoked from every client role;
 * pg runs as postgres). Rooms are inserted straight into the table with a
 * crafted last_activity_at — the RPCs are Unit 1's concern.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { GOOD_TABLE, createRoomFixtureTables, dropRoomFixtureTables } from './roomsFixtures';

describe('sweep_stale_rooms (Unit 2)', () => {
  let memberId: string;
  const roomIds: string[] = [];

  /** Insert a room with a specific last_activity_at (SQL expression). */
  async function makeRoom(activitySql: string): Promise<string> {
    const r = await executeSql(
      `INSERT INTO public.rooms (host_member_id, game_key, game_tables, last_activity_at)
       VALUES ($1, 'test_game', ARRAY[$2]::text[], ${activitySql})
       RETURNING id`,
      [memberId, GOOD_TABLE]
    );
    roomIds.push(r[0].id);
    return r[0].id;
  }

  const sweep = async (hours?: number): Promise<number> =>
    (await executeSql(
      hours === undefined ? `SELECT public.sweep_stale_rooms() AS n` : `SELECT public.sweep_stale_rooms($1) AS n`,
      hours === undefined ? [] : [hours]
    ))[0].n;

  const exists = async (id: string): Promise<boolean> =>
    (await executeSql(`SELECT count(*)::int AS n FROM public.rooms WHERE id = $1`, [id]))[0].n === 1;

  beforeAll(async () => {
    await createRoomFixtureTables();
    const m = await executeSql(`SELECT id FROM public.members LIMIT 1`);
    if (m.length < 1) throw new Error('rooms.sweep.db.test needs a member row in the seed.');
    memberId = m[0].id;
  });

  afterAll(async () => {
    if (roomIds.length) {
      await executeSql(`DELETE FROM public.rooms WHERE id = ANY($1::uuid[])`, [roomIds]);
    }
    await dropRoomFixtureTables();
    await closePostgresPool();
  });

  it('deletes a room idle for 25 hours and keeps one heartbeated an hour ago', async () => {
    const stale = await makeRoom(`now() - interval '25 hours'`);
    const fresh = await makeRoom(`now() - interval '1 hour'`);

    const n = await sweep();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await exists(stale)).toBe(false);
    expect(await exists(fresh)).toBe(true);
  });

  it('cascades: a swept room takes its phones and game-table rows; other rooms are untouched', async () => {
    const stale = await makeRoom(`now() - interval '2 days'`);
    const fresh = await makeRoom(`now()`);
    await executeSql(
      `INSERT INTO public.room_phones (room_id, member_id, device_id, display_name)
       VALUES ($1, $2, gen_random_uuid(), 'A'), ($3, $2, gen_random_uuid(), 'B')`,
      [stale, memberId, fresh]
    );
    await executeSql(
      `INSERT INTO public.${GOOD_TABLE} (room_id, label) VALUES ($1, 'x'), ($1, 'y'), ($2, 'z')`,
      [stale, fresh]
    );

    await sweep();

    const phones = await executeSql(`SELECT room_id FROM public.room_phones WHERE room_id IN ($1, $2)`, [stale, fresh]);
    expect(phones.map((p: { room_id: string }) => p.room_id)).toEqual([fresh]);
    const widgets = await executeSql(`SELECT room_id FROM public.${GOOD_TABLE} WHERE room_id IN ($1, $2)`, [stale, fresh]);
    expect(widgets.map((w: { room_id: string }) => w.room_id)).toEqual([fresh]);
  });

  it('the window is a dial: a 2-hour-idle room survives the default but not a 1-hour window', async () => {
    const room = await makeRoom(`now() - interval '2 hours'`);
    await sweep();
    expect(await exists(room)).toBe(true);
    expect(await sweep(1)).toBeGreaterThanOrEqual(1);
    expect(await exists(room)).toBe(false);
  });

  it('is idempotent: a second sweep right after finds nothing of ours', async () => {
    await makeRoom(`now() - interval '30 hours'`);
    await sweep();
    // Anything else stale in the shared DB was swept by the first call too,
    // so the second call must report zero.
    expect(await sweep()).toBe(0);
  });

  it('is scheduled hourly as game-room-sweep, exactly once, and is not callable by clients', async () => {
    const jobs = await executeSql(`SELECT schedule, command FROM cron.job WHERE jobname = 'game-room-sweep'`);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].schedule).toBe('0 * * * *');
    expect(jobs[0].command).toContain('sweep_stale_rooms');

    const priv = await executeSql(
      `SELECT has_function_privilege('anon', 'public.sweep_stale_rooms(integer)', 'EXECUTE') AS anon,
              has_function_privilege('authenticated', 'public.sweep_stale_rooms(integer)', 'EXECUTE') AS authed`
    );
    expect(priv[0].anon).toBe(false);
    expect(priv[0].authed).toBe(false);
  });
});
