// @vitest-environment jsdom
/**
 * @fileoverview `create_room` (Units 1 + room-race Unit 2): the caller becomes
 * host + first device.
 *
 * A FREE room needs only a signed-in member. A SHARED room needs the host gate:
 * an ACTIVE Host designation (the developer master key passes too; being a
 * league operator does not, by itself). Every member may own at most
 * room_cap_per_host() rooms, free and shared together — rooms no longer
 * self-delete, so the cap is what stops them piling up. The game's table list
 * is validated at creation so a game that forgot its realtime setup fails now,
 * with the reason, instead of silently at play.
 *
 * Happy paths run through real authenticated supabase-js clients (jsdom
 * pragma: happy-dom mangles Content-Type on POST, and an RPC is a POST).
 * No seed user holds a designation: each test grants what it needs, and the
 * tagged fixture rows are removed before every test.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  createAuthenticatedClient,
  getCurrentMemberId,
  executeSql,
  closePostgresPool,
  signOut,
} from '@/test/dbTestUtils';
import {
  GOOD_TABLE,
  BAD_TABLES,
  createRoomFixtureTables,
  dropRoomFixtureTables,
  deleteRoomsHostedBy,
  grantRoomHost,
  revokeRoomHost,
  newDevice,
  rpc,
} from './roomsFixtures';

describe('create_room (Unit 1 + room-race Unit 2)', () => {
  let operator: SupabaseClient<Database>;
  let player: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let operatorMemberId: string;
  let playerMemberId: string;
  let ownerMemberId: string;
  /** room_cap_per_host() — read from the dial so the tests follow it. */
  let cap: number;

  beforeAll(async () => {
    await createRoomFixtureTables();
    operator = await createAuthenticatedClient('operator');
    player = await createAuthenticatedClient('player');
    owner = await createAuthenticatedClient('owner');
    operatorMemberId = (await getCurrentMemberId(operator))!;
    playerMemberId = (await getCurrentMemberId(player))!;
    ownerMemberId = (await getCurrentMemberId(owner))!;
    cap = (await executeSql(`SELECT public.room_cap_per_host() AS n`))[0].n;
  });

  // The cap counts every room a member owns and designations decide the gate,
  // so each test starts with no rooms and no test-granted designations.
  beforeEach(async () => {
    await deleteRoomsHostedBy([operatorMemberId, playerMemberId, ownerMemberId]);
    await revokeRoomHost([operatorMemberId, playerMemberId, ownerMemberId]);
  });

  afterAll(async () => {
    await deleteRoomsHostedBy([operatorMemberId, playerMemberId, ownerMemberId]);
    await revokeRoomHost([operatorMemberId, playerMemberId, ownerMemberId]);
    await dropRoomFixtureTables();
    await signOut(operator);
    await signOut(player);
    await signOut(owner);
    await closePostgresPool();
  });

  const create = (client: SupabaseClient<Database>, over: Record<string, unknown> = {}) =>
    rpc(client, 'create_room', {
      p_game_key: 'test_game',
      p_tables: [GOOD_TABLE],
      p_device_id: newDevice(),
      p_settings: { race_to: 5 },
      p_shared: false,
      ...over,
    });

  const roomsOwnedBy = async (memberId: string): Promise<number> =>
    (await executeSql(`SELECT count(*)::int AS n FROM public.rooms WHERE host_member_id = $1`, [memberId]))[0].n;

  it('a plain player can create a FREE room and becomes its first device — and owns it (is_host)', async () => {
    const r = await create(player);
    expect(r).toMatchObject({ ok: true });
    expect(r.room_id).toBeTruthy();
    expect(r.join_token).toBeTruthy();

    const room = (await executeSql(`SELECT * FROM public.rooms WHERE id = $1`, [r.room_id]))[0];
    expect(room.host_member_id).toBe(playerMemberId);
    expect(room.shared).toBe(false);
    expect(room.game_tables).toEqual([GOOD_TABLE]);
    expect(room.settings).toEqual({ race_to: 5 });

    const phones = await executeSql(`SELECT * FROM public.room_phones WHERE room_id = $1`, [r.room_id]);
    expect(phones).toHaveLength(1);
    expect(phones[0].member_id).toBe(playerMemberId);
    // is_host = OWNS the room (house model, Unit 8) — not the shared-room gate.
    expect(phones[0].is_host).toBe(true);
    expect(phones[0].display_name.length).toBeGreaterThan(0);
  });

  it('a plain player cannot create a SHARED room → not_a_host (a private one still works)', async () => {
    expect(await create(player, { p_shared: true })).toMatchObject({ ok: false, reason: 'not_a_host' });
    expect(await create(player)).toMatchObject({ ok: true });
  });

  it('a league operator WITHOUT the Host designation cannot create a SHARED room', async () => {
    expect(await create(operator, { p_shared: true })).toMatchObject({ ok: false, reason: 'not_a_host' });
    expect(await create(operator)).toMatchObject({ ok: true });
  });

  it('an ENDED Host designation no longer opens shared rooms', async () => {
    await grantRoomHost([operatorMemberId]);
    await executeSql(
      `UPDATE public.member_designations SET ended_at = now()
        WHERE member_id = $1 AND designation = 'host' AND source = 'room_test'`,
      [operatorMemberId]
    );
    expect(await create(operator, { p_shared: true })).toMatchObject({ ok: false, reason: 'not_a_host' });
  });

  it('a developer (the master key) can create a SHARED room without holding host', async () => {
    await grantRoomHost([ownerMemberId], 'developer');
    expect(await create(owner, { p_shared: true })).toMatchObject({ ok: true });
  });

  it('a member holding the Host designation can create a SHARED room; their phone row is flagged is_host', async () => {
    await grantRoomHost([operatorMemberId]);
    const r = await create(operator, { p_shared: true });
    expect(r).toMatchObject({ ok: true });
    const phones = await executeSql(`SELECT is_host FROM public.room_phones WHERE room_id = $1`, [r.room_id]);
    expect(phones[0].is_host).toBe(true);
  });

  it('refuses bad table lists with the specific reason, and writes nothing', async () => {
    const before = await roomsOwnedBy(operatorMemberId);

    expect(await create(operator, { p_tables: ['room_phones'] })).toMatchObject({ ok: false, reason: 'table_reserved' });
    expect(await create(operator, { p_tables: [BAD_TABLES.noFk] })).toMatchObject({ ok: false, reason: 'table_not_ready', missing: 'cascade_fk' });
    expect(await create(operator, { p_tables: [BAD_TABLES.textId] })).toMatchObject({ missing: 'room_id_uuid' });
    expect(await create(operator, { p_tables: [BAD_TABLES.unpublished] })).toMatchObject({ missing: 'publication' });
    expect(await create(operator, { p_tables: [BAD_TABLES.defaultReplica] })).toMatchObject({ missing: 'replica_identity' });
    expect(await create(operator, { p_tables: ['nope'] })).toMatchObject({ missing: 'table' });
    expect(await create(operator, { p_tables: [GOOD_TABLE, BAD_TABLES.noFk, BAD_TABLES.textId, BAD_TABLES.unpublished] })).toMatchObject({ reason: 'too_many_tables' });

    expect(await roomsOwnedBy(operatorMemberId)).toBe(before);
  });

  it('a host at the cap → too_many_rooms (free and shared both count); closing one frees a slot', async () => {
    await grantRoomHost([operatorMemberId]);
    const ids: string[] = [];
    for (let i = 0; i < cap; i++) {
      // Alternate shared and free: the cap is one count across both.
      const r = await create(operator, { p_shared: i % 2 === 0 });
      expect(r).toMatchObject({ ok: true });
      ids.push(r.room_id);
    }

    expect(await create(operator, { p_shared: true })).toEqual({ ok: false, reason: 'too_many_rooms', max: cap });
    expect(await create(operator)).toMatchObject({ ok: false, reason: 'too_many_rooms' });
    expect(await roomsOwnedBy(operatorMemberId)).toBe(cap);

    expect(await rpc(operator, 'close_room', { p_room_id: ids[0] })).toEqual({ ok: true });
    expect(await create(operator, { p_shared: true })).toMatchObject({ ok: true });
  });

  it('a plain player creating FREE rooms hits the same cap', async () => {
    for (let i = 0; i < cap; i++) {
      expect(await create(player)).toMatchObject({ ok: true });
    }
    expect(await create(player)).toEqual({ ok: false, reason: 'too_many_rooms', max: cap });
    expect(await roomsOwnedBy(playerMemberId)).toBe(cap);
  });

  it('two creates at once cannot both slip under the cap (the house lock serializes them)', async () => {
    for (let i = 0; i < cap - 1; i++) await create(player);
    const results = await Promise.all([create(player), create(player)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => r.reason === 'too_many_rooms')).toHaveLength(1);
    expect(await roomsOwnedBy(playerMemberId)).toBe(cap);
  });

  it('rooms no longer self-delete: the game-room-sweep job and its function are gone', async () => {
    const [cron] = await executeSql(`SELECT to_regclass('cron.job') IS NOT NULL AS present`);
    if (cron.present) {
      const [job] = await executeSql(`SELECT count(*)::int AS n FROM cron.job WHERE jobname = 'game-room-sweep'`);
      expect(job.n).toBe(0);
    }
    const [fn] = await executeSql(`SELECT to_regprocedure('public.sweep_stale_rooms(integer)') IS NULL AS gone`);
    expect(fn.gone).toBe(true);
  });

  it('refuses a missing device id or game key', async () => {
    expect(await create(player, { p_device_id: null })).toMatchObject({ ok: false, reason: 'no_device' });
    expect(await create(player, { p_game_key: '  ' })).toMatchObject({ ok: false, reason: 'no_game' });
  });

  it('not signed in → not_signed_in (raw SQL has no auth.uid())', async () => {
    const rows = await executeSql(
      `SELECT public.create_room('test_game', ARRAY[$1]::text[], gen_random_uuid()) AS r`,
      [GOOD_TABLE]
    );
    expect(rows[0].r).toMatchObject({ ok: false, reason: 'not_signed_in' });
  });
});
