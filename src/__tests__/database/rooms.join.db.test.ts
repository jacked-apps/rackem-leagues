// @vitest-environment jsdom
/**
 * @fileoverview `join_room`, HOUSE seats, presence and `room_heartbeat`
 * (Units 1 + 8).
 *
 * The seat rule (house model, Unit 8): seats belong to the HOST, not the
 * room. A host has room_house_seats() (4) seats across every room they own,
 * and a SEAT IS A SCREEN — one present phone row (heartbeat within the grace
 * window) = one websocket — the host's own screens included, because the
 * bill does not know whose a connection is. A guest on two devices, or one
 * device in two rooms, is two seats. A friend who is also a host is just a
 * screen in your house. Only the room's owner funds anything.
 *
 * `operator@test.com` hosts; `player@test.com` + `captain@test.com` are guests;
 * `owner@test.com` is a host-gated member used as "a friend who is also a
 * host". A fourth screen with none of their names on it is a raw-inserted
 * phone row for a seeded member. Raw SQL ages heartbeats and reads ground truth.
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
  createRoomFixtureTables,
  dropRoomFixtureTables,
  deleteRoomsHostedBy,
  newDevice,
  rpc,
  createRoomAs,
  type Jsonb,
} from './roomsFixtures';

describe('join_room + house seats + heartbeat (Units 1 + 8)', () => {
  let operator: SupabaseClient<Database>;
  let player: SupabaseClient<Database>;
  let captain: SupabaseClient<Database>;
  let owner: SupabaseClient<Database>;
  let operatorMemberId: string;
  let playerMemberId: string;
  let captainMemberId: string;
  let ownerMemberId: string;

  beforeAll(async () => {
    await createRoomFixtureTables();
    operator = await createAuthenticatedClient('operator');
    player = await createAuthenticatedClient('player');
    captain = await createAuthenticatedClient('captain');
    owner = await createAuthenticatedClient('owner');
    operatorMemberId = (await getCurrentMemberId(operator))!;
    playerMemberId = (await getCurrentMemberId(player))!;
    captainMemberId = (await getCurrentMemberId(captain))!;
    ownerMemberId = (await getCurrentMemberId(owner))!;
  });

  // House seats span every room a host owns, so each test starts with an
  // empty house — a guest left present by the previous test would count here.
  beforeEach(async () => {
    await deleteRoomsHostedBy([operatorMemberId, playerMemberId, captainMemberId, ownerMemberId]);
  });

  afterAll(async () => {
    await deleteRoomsHostedBy([operatorMemberId, playerMemberId, captainMemberId, ownerMemberId]);
    await dropRoomFixtureTables();
    await signOut(operator);
    await signOut(player);
    await signOut(captain);
    await signOut(owner);
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

  // ---- HOUSE MODEL (Unit 8): seats belong to the host, across every room they own;
  //      a SEAT IS A SCREEN (one present phone row = one websocket), the host's included ----

  /** A present phone row for a member who is none of the four test users. */
  async function seatStranger(roomId: string) {
    const [m] = await executeSql(
      `SELECT id FROM public.members WHERE id <> ALL($1::uuid[]) LIMIT 1`,
      [[operatorMemberId, playerMemberId, captainMemberId, ownerMemberId]]
    );
    await executeSql(
      `INSERT INTO public.room_phones (room_id, member_id, device_id, display_name) VALUES ($1, $2, gen_random_uuid(), 'Stranger')`,
      [roomId, m.id]
    );
  }

  it('the house has 4 seats; the host takes one on creation; three more screens fill it; the next is full', async () => {
    const room = await createRoomAs(operator, { shared: true }); // host's screen = 1
    expect(await seats(room.room_id)).toEqual({ devices: 1, used: 1, seats: 4, open: 3 });

    expect(await join(player, room.join_token)).toMatchObject({ ok: true });
    expect(await join(captain, room.join_token)).toMatchObject({ ok: true });
    await seatStranger(room.room_id);
    expect(await seats(room.room_id)).toEqual({ devices: 4, used: 4, seats: 4, open: 0 });

    const fifth = await join(owner, room.join_token);
    expect(fifth).toMatchObject({ ok: false, reason: 'full' });
    expect(fifth.seats).toEqual({ devices: 4, used: 4, seats: 4, open: 0 });
    expect(typeof fifth.hint).toBe('string');
  });

  it("the host's own second screen is a seat like any other — the bill does not know whose it is", async () => {
    const room = await createRoomAs(operator, { shared: true });
    expect(await join(operator, room.join_token, newDevice())).toMatchObject({ ok: true, rejoined: false });
    expect(await seats(room.room_id)).toEqual({ devices: 2, used: 2, seats: 4, open: 2 });

    // Thirty cheap tablets do not get a pass: the host's 3rd and 4th screens fill the house.
    await join(operator, room.join_token, newDevice());
    await join(operator, room.join_token, newDevice());
    expect(await join(player, room.join_token)).toMatchObject({ ok: false, reason: 'full' });
  });

  it("a guest's second screen is a second seat; the same screen re-opening the same room is free", async () => {
    const room = await createRoomAs(operator, { shared: true });
    const phone = newDevice();
    await join(player, room.join_token, phone);
    await join(player, room.join_token, newDevice()); // tablet
    expect(await seats(room.room_id)).toEqual({ devices: 3, used: 3, seats: 4, open: 1 });

    expect(await join(player, room.join_token, phone)).toMatchObject({ ok: true, rejoined: true });
    expect(await seats(room.room_id)).toEqual({ devices: 3, used: 3, seats: 4, open: 1 });
  });

  it('seats span every room the host owns: screens in room A count against room B, and one screen in two rooms is two', async () => {
    const a = await createRoomAs(operator, { shared: true }); // host's screen in A
    const b = await createRoomAs(operator, { shared: true }); // host's screen in B
    // Two rooms open on two of the host's screens → 2 used before any guest.
    expect(await seats(b.room_id)).toMatchObject({ devices: 1, used: 2, open: 2 });

    const phone = newDevice();
    await join(player, a.join_token, phone);
    expect(await seats(b.room_id)).toMatchObject({ devices: 1, used: 3, open: 1 });

    // The same device walking into B is a second page → a second socket → a second seat.
    expect(await join(player, b.join_token, phone)).toMatchObject({ ok: true, rejoined: false });
    expect(await seats(b.room_id)).toMatchObject({ devices: 2, used: 4, open: 0 });

    // Full at EITHER door.
    expect(await join(captain, b.join_token)).toMatchObject({ ok: false, reason: 'full' });
    expect(await join(captain, a.join_token)).toMatchObject({ ok: false, reason: 'full' });
  });

  it('a friend who is also a host is just a screen in your house — and spends none of their own seats', async () => {
    const room = await createRoomAs(operator, { shared: true });
    expect(await join(owner, room.join_token)).toMatchObject({ ok: true }); // owner passes the host gate
    expect(await seats(room.room_id)).toEqual({ devices: 2, used: 2, seats: 4, open: 2 });

    const theirs = await createRoomAs(owner, { shared: true });
    expect(await seats(theirs.room_id)).toEqual({ devices: 1, used: 1, seats: 4, open: 3 });
  });

  it('is_host on a phone row means OWNS the room, not "passed the gate"', async () => {
    const room = await createRoomAs(operator, { shared: true });
    await join(owner, room.join_token);
    const rows = await executeSql(`SELECT member_id, is_host FROM public.room_phones WHERE room_id = $1`, [room.room_id]);
    expect(rows.find((r: Jsonb) => r.member_id === operatorMemberId).is_host).toBe(true);
    expect(rows.find((r: Jsonb) => r.member_id === ownerMemberId).is_host).toBe(false);
  });

  it('a screen whose heartbeat is older than the grace window is not present and frees its house seat', async () => {
    const room = await createRoomAs(operator, { shared: true });
    const r = await join(player, room.join_token);
    expect(await seats(room.room_id)).toEqual({ devices: 2, used: 2, seats: 4, open: 2 });

    await executeSql(`UPDATE public.room_phones SET last_seen_at = now() - interval '3 minutes' WHERE id = $1`, [r.phone_id]);
    expect(await seats(room.room_id)).toEqual({ devices: 1, used: 1, seats: 4, open: 3 });

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
