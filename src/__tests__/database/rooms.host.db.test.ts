// @vitest-environment jsdom
/**
 * @fileoverview Host controls and reads (Unit 1): `set_room_game` (validate
 * then WIPE the old game's rows), `set_room_settings` (no wipe),
 * `set_room_shared` (open the door in place), `close_room` (cascade), and the
 * two reads `get_room` / `get_room_by_token` ({found:false} once gone).
 *
 * The wipe is the one place the room touches a game's table, and it does so
 * blind — by name, from the STORED list, by room_id. These tests pin that it
 * removes exactly this room's rows and nothing else, and that a refused
 * switch leaves the old game intact.
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
  createRoomAs,
  type Jsonb,
} from './roomsFixtures';

describe('host controls + reads (Unit 1)', () => {
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

  const widgets = async (roomId: string): Promise<number> =>
    (await executeSql(`SELECT count(*)::int AS n FROM public.${GOOD_TABLE} WHERE room_id = $1`, [roomId]))[0].n;

  const addWidgets = (roomId: string, n: number) =>
    executeSql(
      `INSERT INTO public.${GOOD_TABLE} (room_id, label)
       SELECT $1, 'w' || g FROM generate_series(1, $2::int) g`,
      [roomId, n]
    );

  it('set_room_game wipes exactly this room\'s rows from the old tables and updates the row', async () => {
    const mine = await createRoomAs(operator, { shared: true, game: 'race' });
    const other = await createRoomAs(operator, { shared: true, game: 'race' });
    await addWidgets(mine.room_id, 3);
    await addWidgets(other.room_id, 2);

    const r = await rpc(operator, 'set_room_game', {
      p_room_id: mine.room_id,
      p_game_key: 'coin_flip',
      p_tables: [GOOD_TABLE],
      p_settings: { best_of: 1 },
    });
    expect(r).toMatchObject({ ok: true });

    expect(await widgets(mine.room_id)).toBe(0);
    expect(await widgets(other.room_id)).toBe(2);
    const row = (await executeSql(`SELECT game_key, settings FROM public.rooms WHERE id = $1`, [mine.room_id]))[0];
    expect(row.game_key).toBe('coin_flip');
    expect(row.settings).toEqual({ best_of: 1 });
  });

  it('a refused switch (bad new table list) leaves the old game intact', async () => {
    const room = await createRoomAs(operator, { shared: true });
    await addWidgets(room.room_id, 2);

    const r = await rpc(operator, 'set_room_game', {
      p_room_id: room.room_id,
      p_game_key: 'other',
      p_tables: [BAD_TABLES.noFk],
    });
    expect(r).toMatchObject({ ok: false, reason: 'table_not_ready' });
    expect(await widgets(room.room_id)).toBe(2);
    expect((await executeSql(`SELECT game_key FROM public.rooms WHERE id = $1`, [room.room_id]))[0].game_key).toBe('test_game');
  });

  it('only the host may switch games, change settings, open the door, or close', async () => {
    const room = await createRoomAs(operator, { shared: true });
    await rpc(player, 'join_room', { p_join_token: room.join_token, p_device_id: newDevice() });

    expect(await rpc(player, 'set_room_game', { p_room_id: room.room_id, p_game_key: 'x', p_tables: [GOOD_TABLE] })).toMatchObject({ reason: 'not_host' });
    expect(await rpc(player, 'set_room_settings', { p_room_id: room.room_id, p_settings: {} })).toMatchObject({ reason: 'not_host' });
    expect(await rpc(player, 'set_room_shared', { p_room_id: room.room_id, p_shared: false })).toMatchObject({ reason: 'not_host' });
    expect(await rpc(player, 'close_room', { p_room_id: room.room_id })).toMatchObject({ reason: 'not_host' });
    expect(await rpc(player, 'get_room', { p_room_id: room.room_id })).toMatchObject({ found: true });
  });

  it('set_room_settings changes settings and leaves every game row in place', async () => {
    const room = await createRoomAs(operator, { shared: true });
    await addWidgets(room.room_id, 4);
    expect(await rpc(operator, 'set_room_settings', { p_room_id: room.room_id, p_settings: { race_to: 9 } })).toEqual({ ok: true });
    expect(await widgets(room.room_id)).toBe(4);
    expect((await executeSql(`SELECT settings FROM public.rooms WHERE id = $1`, [room.room_id]))[0].settings).toEqual({ race_to: 9 });
  });

  it('a player cannot open the door on their free room; an operator can, in place, and guests may then join', async () => {
    const playersRoom = await createRoomAs(player, { shared: false });
    expect(await rpc(player, 'set_room_shared', { p_room_id: playersRoom.room_id, p_shared: true })).toMatchObject({ reason: 'not_a_host' });

    const room = await createRoomAs(operator, { shared: false });
    await addWidgets(room.room_id, 1);
    expect(await rpc(player, 'join_room', { p_join_token: room.join_token, p_device_id: newDevice() })).toMatchObject({ reason: 'not_shared' });

    expect(await rpc(operator, 'set_room_shared', { p_room_id: room.room_id, p_shared: true })).toEqual({ ok: true });
    expect(await rpc(player, 'join_room', { p_join_token: room.join_token, p_device_id: newDevice() })).toMatchObject({ ok: true });
    // the game in progress did not notice
    expect(await widgets(room.room_id)).toBe(1);
    // and the host's own phone row now carries the gate result
    const host = (await executeSql(`SELECT is_host FROM public.room_phones WHERE room_id = $1 AND member_id = $2`, [room.room_id, operatorMemberId]))[0];
    expect(host.is_host).toBe(true);
  });

  it('close_room deletes the room and cascades to phones and game rows; reads then say found:false', async () => {
    const room = await createRoomAs(operator, { shared: true });
    await rpc(player, 'join_room', { p_join_token: room.join_token, p_device_id: newDevice() });
    await addWidgets(room.room_id, 2);

    expect(await rpc(operator, 'close_room', { p_room_id: room.room_id })).toEqual({ ok: true });

    expect((await executeSql(`SELECT count(*)::int AS n FROM public.rooms WHERE id = $1`, [room.room_id]))[0].n).toBe(0);
    expect((await executeSql(`SELECT count(*)::int AS n FROM public.room_phones WHERE room_id = $1`, [room.room_id]))[0].n).toBe(0);
    expect(await widgets(room.room_id)).toBe(0);
    expect(await rpc(player, 'get_room', { p_room_id: room.room_id })).toEqual({ found: false });
    expect(await rpc(player, 'get_room_by_token', { p_join_token: room.join_token })).toEqual({ found: false });
    expect(await rpc(operator, 'close_room', { p_room_id: room.room_id })).toMatchObject({ reason: 'not_found' });
  });

  it('get_room_by_token / get_room return the room, derived seats, and every device with is_present', async () => {
    const room = await createRoomAs(operator, { shared: true });
    const joined = await rpc(player, 'join_room', { p_join_token: room.join_token, p_device_id: newDevice() });

    const byToken = await rpc(player, 'get_room_by_token', { p_join_token: room.join_token });
    expect(byToken.found).toBe(true);
    expect(byToken.room).toMatchObject({ id: room.room_id, game_key: 'test_game', game_tables: [GOOD_TABLE], shared: true, host_member_id: operatorMemberId });
    expect(byToken.seats).toEqual({ devices: 2, guests: 1, seats: 3, open: 2 });
    expect(byToken.phones).toHaveLength(2);
    const me = byToken.phones.find((p: Jsonb) => p.id === joined.phone_id);
    expect(me).toMatchObject({ member_id: playerMemberId, is_host: false, is_present: true });
    expect(typeof me.display_name).toBe('string');

    const byId = await rpc(player, 'get_room', { p_room_id: room.room_id });
    expect(byId).toEqual(byToken);
  });
});
