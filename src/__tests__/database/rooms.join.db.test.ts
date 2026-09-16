// @vitest-environment jsdom
/**
 * @fileoverview `join_room`, seats, presence and `room_heartbeat` (Unit 1).
 *
 * The seat rule: a seat is a DEVICE (Supabase bills per socket), allowance is
 * per PERSON — open = distinct hosts present × 4 − devices present. A host's
 * second device takes a seat and adds no allowance. "Present" = heartbeat
 * within the grace window; a sleeping phone keeps its seat until then.
 *
 * `operator@test.com` is the host (league_operator); `player@test.com` is a
 * guest. Device ids are minted freely — that is exactly what makes seats
 * testable with two users. Raw SQL is used to age heartbeats and to read
 * ground truth.
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
  createRoomFixtureTables,
  dropRoomFixtureTables,
  deleteRoomsHostedBy,
  newDevice,
  rpc,
  createRoomAs,
  type Jsonb,
} from './roomsFixtures';

describe('join_room + seats + heartbeat (Unit 1)', () => {
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

  const join = (client: SupabaseClient<Database>, token: string, device = newDevice()) =>
    rpc(client, 'join_room', { p_join_token: token, p_device_id: device });

  const seats = async (roomId: string) =>
    (await executeSql(`SELECT public.room_seats($1) AS s`, [roomId]))[0].s;

  it('unknown token → not_found; a free room → not_shared', async () => {
    expect(await join(player, newDevice())).toMatchObject({ ok: false, reason: 'not_found' });
    const free = await createRoomAs(operator, { shared: false });
    expect(await join(player, free.join_token)).toMatchObject({ ok: false, reason: 'not_shared' });
  });

  it('a guest joins a shared room; the same device rejoins without a new row; a second device is a new row', async () => {
    const room = await createRoomAs(operator, { shared: true });
    const deviceA = newDevice();

    const first = await join(player, room.join_token, deviceA);
    expect(first).toMatchObject({ ok: true, rejoined: false, room_id: room.room_id });

    const again = await join(player, room.join_token, deviceA);
    expect(again).toMatchObject({ ok: true, rejoined: true, phone_id: first.phone_id });

    const second = await join(player, room.join_token, newDevice());
    expect(second).toMatchObject({ ok: true, rejoined: false });
    expect(second.phone_id).not.toBe(first.phone_id);

    const rows = await executeSql(
      `SELECT member_id, is_host FROM public.room_phones WHERE room_id = $1 ORDER BY joined_at`,
      [room.room_id]
    );
    // host device + player's two devices
    expect(rows).toHaveLength(3);
    expect(rows.filter((r: Jsonb) => r.member_id === playerMemberId)).toHaveLength(2);
    expect(rows.find((r: Jsonb) => r.member_id === playerMemberId).is_host).toBe(false);
  });

  it('one host present → 4 devices fit; the 5th is refused as full with the seat picture', async () => {
    const room = await createRoomAs(operator, { shared: true }); // host device = 1
    expect(await seats(room.room_id)).toEqual({ devices: 1, hosts: 1, open: 3 });

    for (let i = 0; i < 3; i++) {
      expect(await join(player, room.join_token)).toMatchObject({ ok: true });
    }
    expect(await seats(room.room_id)).toEqual({ devices: 4, hosts: 1, open: 0 });

    const fifth = await join(player, room.join_token);
    expect(fifth).toMatchObject({ ok: false, reason: 'full' });
    expect(fifth.seats).toEqual({ devices: 4, hosts: 1, open: 0 });
    expect(typeof fifth.hint).toBe('string');
  });

  it("a host's second device takes a seat and adds no allowance", async () => {
    const room = await createRoomAs(operator, { shared: true });
    expect(await join(operator, room.join_token, newDevice())).toMatchObject({ ok: true, rejoined: false });
    // still ONE host for allowance, TWO devices for seats
    expect(await seats(room.room_id)).toEqual({ devices: 2, hosts: 1, open: 2 });
  });

  it('a device whose heartbeat is older than the grace window is not present and frees its seat', async () => {
    const room = await createRoomAs(operator, { shared: true });
    const r = await join(player, room.join_token);
    expect(await seats(room.room_id)).toEqual({ devices: 2, hosts: 1, open: 2 });

    await executeSql(`UPDATE public.room_phones SET last_seen_at = now() - interval '3 minutes' WHERE id = $1`, [r.phone_id]);
    expect(await seats(room.room_id)).toEqual({ devices: 1, hosts: 1, open: 3 });

    const state = await rpc(player, 'get_room', { p_room_id: room.room_id });
    const mine = state.phones.find((p: Jsonb) => p.id === r.phone_id);
    expect(mine.is_present).toBe(false);
    expect(state.phones.find((p: Jsonb) => p.member_id === operatorMemberId).is_present).toBe(true);
  });

  it('room_heartbeat refreshes the device and bumps the room row only when it is stale', async () => {
    const room = await createRoomAs(operator, { shared: true });
    const device = newDevice();
    const r = await join(player, room.join_token, device);

    // Age both, then heartbeat: the phone is fresh again and the (10-minute-old) room row is bumped.
    await executeSql(`UPDATE public.room_phones SET last_seen_at = now() - interval '3 minutes' WHERE id = $1`, [r.phone_id]);
    await executeSql(`UPDATE public.rooms SET last_activity_at = now() - interval '10 minutes' WHERE id = $1`, [room.room_id]);
    expect(await rpc(player, 'room_heartbeat', { p_room_id: room.room_id, p_device_id: device })).toEqual({ ok: true });

    const phone = (await executeSql(`SELECT last_seen_at > now() - interval '1 minute' AS fresh FROM public.room_phones WHERE id = $1`, [r.phone_id]))[0];
    expect(phone.fresh).toBe(true);
    const after1 = (await executeSql(`SELECT last_activity_at FROM public.rooms WHERE id = $1`, [room.room_id]))[0].last_activity_at;
    expect(new Date(after1).getTime()).toBeGreaterThan(Date.now() - 60_000);

    // A second heartbeat within the threshold leaves the room row alone.
    await rpc(player, 'room_heartbeat', { p_room_id: room.room_id, p_device_id: device });
    const after2 = (await executeSql(`SELECT last_activity_at FROM public.rooms WHERE id = $1`, [room.room_id]))[0].last_activity_at;
    expect(new Date(after2).getTime()).toBe(new Date(after1).getTime());
  });

  it('room_heartbeat for a device that never joined → not_in_room', async () => {
    const room = await createRoomAs(operator, { shared: true });
    expect(await rpc(player, 'room_heartbeat', { p_room_id: room.room_id, p_device_id: newDevice() })).toMatchObject({
      ok: false,
      reason: 'not_in_room',
    });
  });

  it('not signed in → not_signed_in (raw SQL has no auth.uid())', async () => {
    const room = await createRoomAs(operator, { shared: true });
    const rows = await executeSql(`SELECT public.join_room($1, gen_random_uuid()) AS r`, [room.join_token]);
    expect(rows[0].r).toMatchObject({ ok: false, reason: 'not_signed_in' });
  });
});
