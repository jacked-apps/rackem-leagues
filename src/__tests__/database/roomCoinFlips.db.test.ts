// @vitest-environment jsdom
/**
 * @fileoverview The two-phone coin flip's trust boundary (Game Room Unit 6).
 *
 * The whole point of `room_coin_flips` is that the DATABASE decides the face:
 * `call_room_coin` accepts only the caller phone and only before the throw;
 * `throw_room_coin` accepts only the flipper phone, only once there is a call,
 * and only once. These tests pin every refusal by name, and pin that the
 * table honours the room's plug-in contract (so `create_room` will take it).
 *
 * `operator@test.com` hosts (passes the host gate → can open a shared room);
 * `player@test.com` joins. Each is one phone; the flip is between the two.
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
import { deleteRoomsHostedBy, newDevice, rpc, type Jsonb } from './roomsFixtures';

const TABLE = 'room_coin_flips';

describe('room_coin_flips + RPCs (Unit 6)', () => {
  let operator: SupabaseClient<Database>;
  let player: SupabaseClient<Database>;
  let operatorMemberId: string;
  let playerMemberId: string;

  beforeAll(async () => {
    operator = await createAuthenticatedClient('operator');
    player = await createAuthenticatedClient('player');
    operatorMemberId = (await getCurrentMemberId(operator))!;
    playerMemberId = (await getCurrentMemberId(player))!;
  });

  afterAll(async () => {
    await deleteRoomsHostedBy([operatorMemberId, playerMemberId]);
    await signOut(operator);
    await signOut(player);
    await closePostgresPool();
  });

  /** A shared coin-flip room with the operator's phone + the player's phone. */
  async function twoPhoneRoom() {
    const created = await rpc(operator, 'create_room', {
      p_game_key: 'coin_flip',
      p_tables: [TABLE],
      p_device_id: newDevice(),
      p_settings: {},
      p_shared: true,
    });
    expect(created.ok, JSON.stringify(created)).toBe(true);
    const joined = await rpc(player, 'join_room', { p_join_token: created.join_token, p_device_id: newDevice() });
    expect(joined.ok).toBe(true);

    const phones: Jsonb[] = await executeSql(
      `SELECT id, member_id FROM public.room_phones WHERE room_id = $1`,
      [created.room_id]
    );
    const hostPhone = phones.find((p) => p.member_id === operatorMemberId)!.id as string;
    const guestPhone = phones.find((p) => p.member_id === playerMemberId)!.id as string;
    return { roomId: created.room_id as string, hostPhone, guestPhone };
  }

  /** Player calls, operator throws. */
  async function startFlip() {
    const r = await twoPhoneRoom();
    const started = await rpc(player, 'start_room_coin_flip', {
      p_room_id: r.roomId, p_caller_phone_id: r.guestPhone, p_flipper_phone_id: r.hostPhone,
    });
    expect(started.ok, JSON.stringify(started)).toBe(true);
    return { ...r, flipId: started.flip_id as string };
  }

  const face = async (flipId: string) =>
    (await executeSql(`SELECT call, face, thrown_at FROM public.${TABLE} WHERE id = $1`, [flipId]))[0];

  it('honours the plug-in contract: create_room accepts it (published, replica full, cascade FK)', async () => {
    const { roomId } = await twoPhoneRoom(); // create_room already validated the table
    expect(roomId).toBeTruthy();
    const [pub] = await executeSql(
      `SELECT count(*)::int AS n FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = $1`,
      [TABLE]
    );
    expect(pub.n).toBe(1);
    const [rel] = await executeSql(`SELECT relreplident FROM pg_class WHERE relname = $1`, [TABLE]);
    expect(rel.relreplident).toBe('f');
  });

  it('happy path: call, then throw → a face of heads or tails exactly once; a second throw → already_thrown', async () => {
    const { flipId } = await startFlip();

    expect(await rpc(player, 'call_room_coin', { p_flip_id: flipId, p_call: 'heads' })).toEqual({ ok: true });
    const thrown = await rpc(operator, 'throw_room_coin', { p_flip_id: flipId });
    expect(thrown.ok).toBe(true);
    expect(['heads', 'tails']).toContain(thrown.face);

    const row = await face(flipId);
    expect(row.call).toBe('heads');
    expect(row.face).toBe(thrown.face);
    expect(row.thrown_at).not.toBeNull();

    expect(await rpc(operator, 'throw_room_coin', { p_flip_id: flipId })).toMatchObject({ ok: false, reason: 'already_thrown' });
    expect((await face(flipId)).face).toBe(thrown.face);
  });

  it('throw before a call → no_call; throw by the caller phone → not_flipper', async () => {
    const { flipId } = await startFlip();
    expect(await rpc(operator, 'throw_room_coin', { p_flip_id: flipId })).toMatchObject({ ok: false, reason: 'no_call' });
    await rpc(player, 'call_room_coin', { p_flip_id: flipId, p_call: 'tails' });
    expect(await rpc(player, 'throw_room_coin', { p_flip_id: flipId })).toMatchObject({ ok: false, reason: 'not_flipper' });
    expect((await face(flipId)).face).toBeNull();
  });

  it('a call by the flipper phone → not_caller; a bad side → bad_call; the call may change until the throw', async () => {
    const { flipId } = await startFlip();
    expect(await rpc(operator, 'call_room_coin', { p_flip_id: flipId, p_call: 'heads' })).toMatchObject({ ok: false, reason: 'not_caller' });
    expect(await rpc(player, 'call_room_coin', { p_flip_id: flipId, p_call: 'edge' })).toMatchObject({ ok: false, reason: 'bad_call' });

    await rpc(player, 'call_room_coin', { p_flip_id: flipId, p_call: 'heads' });
    await rpc(player, 'call_room_coin', { p_flip_id: flipId, p_call: 'tails' });
    expect((await face(flipId)).call).toBe('tails');
  });

  it('a call after the face exists → already_thrown and the stored call is unchanged', async () => {
    const { flipId } = await startFlip();
    await rpc(player, 'call_room_coin', { p_flip_id: flipId, p_call: 'heads' });
    await rpc(operator, 'throw_room_coin', { p_flip_id: flipId });

    expect(await rpc(player, 'call_room_coin', { p_flip_id: flipId, p_call: 'tails' })).toMatchObject({ ok: false, reason: 'already_thrown' });
    expect((await face(flipId)).call).toBe('heads');
  });

  it('start refuses: the same phone twice, a phone from elsewhere, and a member who is in neither role', async () => {
    const a = await twoPhoneRoom();
    const b = await twoPhoneRoom();

    expect(await rpc(player, 'start_room_coin_flip', {
      p_room_id: a.roomId, p_caller_phone_id: a.guestPhone, p_flipper_phone_id: a.guestPhone,
    })).toMatchObject({ ok: false, reason: 'same_phone' });

    expect(await rpc(player, 'start_room_coin_flip', {
      p_room_id: a.roomId, p_caller_phone_id: a.guestPhone, p_flipper_phone_id: b.hostPhone,
    })).toMatchObject({ ok: false, reason: 'phone_not_in_room' });

    // Two of the operator's phones in room a would be fine — but the PLAYER
    // starting a flip between two phones that are not theirs is not.
    const second = await rpc(operator, 'join_room', { p_join_token: (await executeSql(
      `SELECT join_token FROM public.rooms WHERE id = $1`, [a.roomId]))[0].join_token, p_device_id: newDevice() });
    expect(second.ok).toBe(true);
    expect(await rpc(player, 'start_room_coin_flip', {
      p_room_id: a.roomId, p_caller_phone_id: a.hostPhone, p_flipper_phone_id: second.phone_id,
    })).toMatchObject({ ok: false, reason: 'not_in_flip' });

    expect(await rpc(player, 'call_room_coin', { p_flip_id: newDevice(), p_call: 'heads' })).toMatchObject({ ok: false, reason: 'not_found' });
  });

  it('deleting the room removes its flips; anon is refused', async () => {
    const { roomId, flipId } = await startFlip();
    await executeSql(`DELETE FROM public.rooms WHERE id = $1`, [roomId]);
    expect(await executeSql(`SELECT 1 FROM public.${TABLE} WHERE id = $1`, [flipId])).toHaveLength(0);

    const [grant] = await executeSql(
      `SELECT has_function_privilege('anon', 'public.throw_room_coin(uuid)', 'EXECUTE') AS anon`
    );
    expect(grant.anon).toBe(false);
  });
});
