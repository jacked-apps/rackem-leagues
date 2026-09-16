// @vitest-environment jsdom
/**
 * @fileoverview The Game Room's client-side reads against the real database
 * (Unit 3). `getMyRooms` is a joined PostgREST select — exactly the kind of
 * query a green mocked test cannot vouch for (see the My Stats lesson) — and
 * `getRoom` / `getRoomByToken` must turn `{found:false}` into `null`.
 *
 * Runs the real `src/api/queries/rooms.ts` functions through the app's
 * supabase singleton, signed in as the test users.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { supabase } from '@/supabaseClient';
import { TEST_USERS, createAuthenticatedClient, getCurrentMemberId, closePostgresPool, signOut } from '@/test/dbTestUtils';
import { getMyRooms, getRoom, getRoomByToken } from '@/api/queries/rooms';
import { createRoomFixtureTables, dropRoomFixtureTables, deleteRoomsHostedBy, newDevice, rpc, createRoomAs } from './roomsFixtures';

describe('room queries (Unit 3)', () => {
  let operator: SupabaseClient<Database>;
  let operatorMemberId: string;
  let playerMemberId: string;

  beforeAll(async () => {
    await createRoomFixtureTables();
    operator = await createAuthenticatedClient('operator');
    operatorMemberId = (await getCurrentMemberId(operator))!;
    // The app singleton is what the query functions use — sign it in as the player.
    const { error } = await supabase.auth.signInWithPassword({
      email: TEST_USERS.player.email,
      password: TEST_USERS.player.password,
    });
    if (error) throw new Error(`player sign-in failed: ${error.message}`);
    playerMemberId = (await getCurrentMemberId(supabase))!;
  });

  afterAll(async () => {
    await deleteRoomsHostedBy([operatorMemberId, playerMemberId]);
    await dropRoomFixtureTables();
    await signOut(operator);
    await supabase.auth.signOut();
    await closePostgresPool();
  });

  it('getMyRooms lists each room the member has a device in, once, newest first, with the host flag', async () => {
    const a = await createRoomAs(operator, { shared: true, game: 'race' });
    const b = await createRoomAs(operator, { shared: true, game: 'coin_flip' });
    const notMine = await createRoomAs(operator, { shared: true });

    // player: two devices in room a, one in room b, none in notMine
    await rpc(supabase, 'join_room', { p_join_token: a.join_token, p_device_id: newDevice() });
    await rpc(supabase, 'join_room', { p_join_token: a.join_token, p_device_id: newDevice() });
    await rpc(supabase, 'join_room', { p_join_token: b.join_token, p_device_id: newDevice() });

    const mine = await getMyRooms(playerMemberId);
    const ids = mine.map((r) => r.room_id);
    expect(ids).toContain(a.room_id);
    expect(ids).toContain(b.room_id);
    expect(ids).not.toContain(notMine.room_id);
    expect(ids.filter((id) => id === a.room_id)).toHaveLength(1);
    expect(mine.find((r) => r.room_id === a.room_id)).toMatchObject({ game_key: 'race', shared: true, is_host: false });
    expect(ids.indexOf(b.room_id)).toBeLessThan(ids.indexOf(a.room_id));

    // the host sees their own rooms flagged
    const hosts = await getMyRooms(operatorMemberId);
    expect(hosts.find((r) => r.room_id === a.room_id)?.is_host).toBe(true);
  });

  it('getRoom / getRoomByToken return the state, and null once the room is closed', async () => {
    const room = await createRoomAs(operator, { shared: true });

    const byId = await getRoom(room.room_id);
    expect(byId?.room.id).toBe(room.room_id);
    expect(byId?.seats).toEqual({ devices: 1, hosts: 1, open: 3 });
    expect(byId?.phones).toHaveLength(1);
    expect(await getRoomByToken(room.join_token)).toEqual(byId);

    await rpc(operator, 'close_room', { p_room_id: room.room_id });
    expect(await getRoom(room.room_id)).toBeNull();
    expect(await getRoomByToken(room.join_token)).toBeNull();
  });
});
