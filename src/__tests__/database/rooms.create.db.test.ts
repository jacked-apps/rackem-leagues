// @vitest-environment jsdom
/**
 * @fileoverview `create_room` (Unit 1): the caller becomes host + first device.
 *
 * A FREE room needs only a signed-in member. A SHARED room needs the host gate
 * (interim: members.role in league_operator/developer). The game's table list
 * is validated at creation so a game that forgot its realtime setup fails now,
 * with the reason, instead of silently at play.
 *
 * Happy paths run through real authenticated supabase-js clients (jsdom
 * pragma: happy-dom mangles Content-Type on POST, and an RPC is a POST).
 * `operator@test.com` passes the gate; `player@test.com` does not.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
  newDevice,
  rpc,
} from './roomsFixtures';

describe('create_room (Unit 1)', () => {
  let operator: SupabaseClient<Database>;
  let player: SupabaseClient<Database>;
  let operatorMemberId: string;
  let playerMemberId: string;

  beforeAll(async () => {
    await createRoomFixtureTables();
    operator = await createAuthenticatedClient('operator');
    player = await createAuthenticatedClient('player');
    operatorMemberId = (await getCurrentMemberId(operator))!;
    playerMemberId = (await getCurrentMemberId(player))!;
  });

  afterAll(async () => {
    await deleteRoomsHostedBy([operatorMemberId, playerMemberId]);
    await dropRoomFixtureTables();
    await signOut(operator);
    await signOut(player);
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

  it('a plain player cannot create a SHARED room → not_a_host', async () => {
    expect(await create(player, { p_shared: true })).toMatchObject({ ok: false, reason: 'not_a_host' });
  });

  it('a league operator can create a SHARED room; their phone row is flagged is_host', async () => {
    const r = await create(operator, { p_shared: true });
    expect(r).toMatchObject({ ok: true });
    const phones = await executeSql(`SELECT is_host FROM public.room_phones WHERE room_id = $1`, [r.room_id]);
    expect(phones[0].is_host).toBe(true);
  });

  it('refuses bad table lists with the specific reason, and writes nothing', async () => {
    const before = (await executeSql(`SELECT count(*)::int AS n FROM public.rooms WHERE host_member_id = $1`, [operatorMemberId]))[0].n;

    expect(await create(operator, { p_tables: ['room_phones'] })).toMatchObject({ ok: false, reason: 'table_reserved' });
    expect(await create(operator, { p_tables: [BAD_TABLES.noFk] })).toMatchObject({ ok: false, reason: 'table_not_ready', missing: 'cascade_fk' });
    expect(await create(operator, { p_tables: [BAD_TABLES.textId] })).toMatchObject({ missing: 'room_id_uuid' });
    expect(await create(operator, { p_tables: [BAD_TABLES.unpublished] })).toMatchObject({ missing: 'publication' });
    expect(await create(operator, { p_tables: [BAD_TABLES.defaultReplica] })).toMatchObject({ missing: 'replica_identity' });
    expect(await create(operator, { p_tables: ['nope'] })).toMatchObject({ missing: 'table' });
    expect(await create(operator, { p_tables: [GOOD_TABLE, BAD_TABLES.noFk, BAD_TABLES.textId, BAD_TABLES.unpublished] })).toMatchObject({ reason: 'too_many_tables' });

    const after = (await executeSql(`SELECT count(*)::int AS n FROM public.rooms WHERE host_member_id = $1`, [operatorMemberId]))[0].n;
    expect(after).toBe(before);
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
