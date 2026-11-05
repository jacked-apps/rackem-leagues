// @vitest-environment jsdom
/**
 * @fileoverview `room_races` — the Game Room's link to its races (room race
 * plan, Unit 4).
 *
 * Pins the server side of a Friends race played in a room:
 *   - open_room_race makes the room's race ONCE (host home vs the earliest
 *     other guest-list member away, settings read from rooms.settings with no
 *     fallback) and returns the latest one after that;
 *   - Run it back: request / answer, with two requests counting as an accept;
 *   - deleting a link deletes the race only when the room owns it, so closing
 *     the room leaves nothing of the race behind;
 *   - clients can read the table but never write or delete it directly.
 *
 * `operator@test.com` hosts (granted the Host designation), `player@test.com`
 * is the first guest, `captain@test.com` a later third member.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import {
  createAuthenticatedClient,
  getCurrentMemberId,
  executeSql,
  closePostgresPool,
  signOut,
} from '@/test/dbTestUtils';
import { deleteRoomsHostedBy, grantRoomHost, revokeRoomHost, newDevice, rpc, type Jsonb } from './roomsFixtures';

const TABLE = 'room_races';
/** The race definition's settings (Unit 6 writes these at create). */
const SETTINGS = { base: 5, break_rule: 'winner_breaks', game_type: 'eight_ball' };

describe('room_races: open, Run it back, delete-with-room (Unit 4)', () => {
  let host: SupabaseClient<Database>;
  let guest: SupabaseClient<Database>;
  let third: SupabaseClient<Database>;
  let hostId: string;
  let guestId: string;
  let thirdId: string;
  /** Races deliberately left outside any room (owns_race = false), cleaned at the end. */
  const strayRaces: string[] = [];

  beforeAll(async () => {
    host = await createAuthenticatedClient('operator');
    guest = await createAuthenticatedClient('player');
    third = await createAuthenticatedClient('captain');
    hostId = (await getCurrentMemberId(host))!;
    guestId = (await getCurrentMemberId(guest))!;
    thirdId = (await getCurrentMemberId(third))!;
    await grantRoomHost([hostId]);
  });

  beforeEach(async () => {
    await deleteRoomsHostedBy([hostId, guestId, thirdId]);
  });

  afterAll(async () => {
    await deleteRoomsHostedBy([hostId, guestId, thirdId]);
    if (strayRaces.length) await executeSql(`DELETE FROM public.races WHERE id = ANY($1::uuid[])`, [strayRaces]);
    await revokeRoomHost([hostId]);
    await signOut(host);
    await signOut(guest);
    await signOut(third);
    await closePostgresPool();
  });

  /** A shared race room; `joiners` join in order (so joined_at follows it). */
  async function raceRoom(opts: { settings?: Record<string, Json>; joiners?: SupabaseClient<Database>[] } = {}) {
    const created = await rpc(host, 'create_room', {
      p_game_key: 'race',
      p_tables: [TABLE],
      p_device_id: newDevice(),
      p_settings: opts.settings ?? SETTINGS,
      p_shared: true,
      p_max_screens: 4,
    });
    expect(created.ok, JSON.stringify(created)).toBe(true);
    for (const c of opts.joiners ?? [guest]) {
      const joined = await rpc(c, 'join_room', { p_join_token: created.join_token, p_device_id: newDevice() });
      expect(joined.ok, JSON.stringify(joined)).toBe(true);
    }
    return { roomId: created.room_id as string, token: created.join_token as string };
  }

  const open = (c: SupabaseClient<Database>, roomId: string) => rpc(c, 'open_room_race', { p_room_id: roomId });
  const race = async (id: string): Promise<Jsonb> =>
    (await executeSql(`SELECT * FROM public.races WHERE id = $1`, [id]))[0];
  const links = (roomId: string): Promise<Jsonb[]> =>
    executeSql(`SELECT * FROM public.${TABLE} WHERE room_id = $1 ORDER BY seq`, [roomId]);

  /** Play a base-1 race to the finish through the real RPCs (host wins game 1). */
  async function finish(raceId: string) {
    expect((await rpc(host, 'start_race', { p_race_id: raceId, p_first_breaker_side: 'home' })).ok).toBe(true);
    expect((await rpc(guest, 'start_race', { p_race_id: raceId, p_first_breaker_side: 'home' })).ok).toBe(true);
    const rec = await rpc(host, 'record_race_game', { p_race_id: raceId, p_game_number: 1, p_winner_player_id: hostId });
    expect(rec.ok, JSON.stringify(rec)).toBe(true);
    const conf = await rpc(guest, 'confirm_race_game', { p_race_id: raceId, p_game_number: 1 });
    expect(conf.ok, JSON.stringify(conf)).toBe(true);
    expect((await race(raceId)).status).toBe('finished');
  }

  /** A room whose first race (base 1) is already finished. */
  async function finishedRoom() {
    const r = await raceRoom({ settings: { ...SETTINGS, base: 1 } });
    const opened = await open(host, r.roomId);
    await finish(opened.race_id);
    return { ...r, raceId: opened.race_id as string };
  }

  it('honours the plug-in contract: room_validate_tables passes and create_room accepts it', async () => {
    const [v] = await executeSql(`SELECT public.room_validate_tables(ARRAY['${TABLE}']) AS r`);
    expect(v.r).toBeNull();
    const { roomId } = await raceRoom();
    expect(roomId).toBeTruthy();
  });

  it('happy path: host + guest → host home, goals 5/5, winner_breaks, eight_ball, status created', async () => {
    const { roomId } = await raceRoom();
    const opened = await open(guest, roomId);
    expect(opened).toMatchObject({ ok: true, seq: 1, created: true });
    const r = await race(opened.race_id);
    expect(r).toMatchObject({
      home_member_id: hostId, away_member_id: guestId, goal_home: 5, goal_away: 5,
      break_rule: 'winner_breaks', game_type: 'eight_ball', status: 'created',
    });
  });

  it('settings base 7 → goals 7/7 (read from the room, not hard-coded)', async () => {
    const { roomId } = await raceRoom({ settings: { ...SETTINGS, base: 7, break_rule: 'alternate', game_type: 'nine_ball' } });
    const r = await race((await open(host, roomId)).race_id);
    expect(r).toMatchObject({ goal_home: 7, goal_away: 7, break_rule: 'alternate', game_type: 'nine_ball' });
  });

  it('idempotent: both phones open → one race, one link row; a duplicate seq insert fails', async () => {
    const { roomId } = await raceRoom();
    const a = await open(host, roomId);
    const b = await open(guest, roomId);
    expect(b).toMatchObject({ ok: true, race_id: a.race_id, seq: 1, created: false });
    expect(await links(roomId)).toHaveLength(1);
    await expect(
      executeSql(`INSERT INTO public.${TABLE} (room_id, race_id, seq) VALUES ($1, $2, 1)`, [roomId, a.race_id])
    ).rejects.toThrow(/room_races_room_seq_key|duplicate key/);
  });

  it('need_opponent: the host alone, and the host on two devices', async () => {
    const { roomId } = await raceRoom({ joiners: [] });
    expect(await open(host, roomId)).toEqual({ ok: false, reason: 'need_opponent' });
    const [{ join_token }] = await executeSql(`SELECT join_token FROM public.rooms WHERE id = $1`, [roomId]);
    expect((await rpc(host, 'join_room', { p_join_token: join_token, p_device_id: newDevice() })).ok).toBe(true);
    expect(await open(host, roomId)).toEqual({ ok: false, reason: 'need_opponent' });
    expect(await links(roomId)).toHaveLength(0);
  });

  it('not_in_room: a member with no phone in the room is refused', async () => {
    const { roomId } = await raceRoom();
    expect(await open(third, roomId)).toEqual({ ok: false, reason: 'not_in_room' });
  });

  it('three members → host vs the EARLIEST other member; the third reads it but cannot score', async () => {
    const { roomId } = await raceRoom({ joiners: [guest, third] });
    const opened = await open(third, roomId); // the third may open it; they still aren't in it
    const r = await race(opened.race_id);
    expect(r).toMatchObject({ home_member_id: hostId, away_member_id: guestId });

    const { data, error } = await third.from('races').select('id').eq('id', opened.race_id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    await rpc(host, 'start_race', { p_race_id: opened.race_id, p_first_breaker_side: 'home' });
    await rpc(guest, 'start_race', { p_race_id: opened.race_id, p_first_breaker_side: 'home' });
    expect(
      await rpc(third, 'record_race_game', { p_race_id: opened.race_id, p_game_number: 1, p_winner_player_id: thirdId })
    ).toMatchObject({ ok: false, reason: 'not_in_race' });
  });

  it('open after the race finished → the same finished race, no new race', async () => {
    const { roomId, raceId } = await finishedRoom();
    expect(await open(guest, roomId)).toMatchObject({ ok: true, race_id: raceId, seq: 1, created: false });
    expect(await links(roomId)).toHaveLength(1);
  });

  it('missing_setting: a room without base is refused and writes nothing', async () => {
    const { roomId } = await raceRoom({ settings: { break_rule: 'alternate', game_type: 'eight_ball' } });
    expect(await open(host, roomId)).toEqual({ ok: false, reason: 'missing_setting', setting: 'base' });
    expect(await links(roomId)).toHaveLength(0);
  });

  it('Run it back: the guest asks, the host accepts → link 2, a fresh created race; race 1 still readable', async () => {
    const { roomId, raceId } = await finishedRoom();
    expect(await rpc(guest, 'request_room_race_rematch', { p_room_id: roomId })).toEqual({ ok: true, state: 'requested' });
    expect((await links(roomId))[0].rematch_requested_by).toBe(guestId);

    const acc = await rpc(host, 'answer_room_race_rematch', { p_room_id: roomId, p_accept: true });
    expect(acc).toMatchObject({ ok: true, state: 'accepted', seq: 2 });
    expect(acc.race_id).not.toBe(raceId);

    const ls = await links(roomId);
    expect(ls.map((l) => l.seq)).toEqual([1, 2]);
    expect(ls[0].rematch_requested_by).toBeNull();
    expect(await race(acc.race_id)).toMatchObject({
      status: 'created', home_member_id: hostId, away_member_id: guestId, goal_home: 1, goal_away: 1,
    });
    expect((await race(raceId)).status).toBe('finished');
    expect(await open(host, roomId)).toMatchObject({ race_id: acc.race_id, seq: 2 });
  });

  it('Run it back: both players request → the second request accepts; exactly one new race', async () => {
    const { roomId } = await finishedRoom();
    expect(await rpc(host, 'request_room_race_rematch', { p_room_id: roomId })).toEqual({ ok: true, state: 'requested' });
    // Repeating your own request is a harmless no-op, not an accept.
    expect(await rpc(host, 'request_room_race_rematch', { p_room_id: roomId })).toEqual({ ok: true, state: 'requested' });
    expect(await rpc(guest, 'request_room_race_rematch', { p_room_id: roomId })).toMatchObject({ ok: true, state: 'accepted', seq: 2 });
    expect(await links(roomId)).toHaveLength(2);
  });

  it('Run it back refusals: unfinished race, answering your own request, a non-player, no request', async () => {
    const { roomId } = await raceRoom({ joiners: [guest, third] });
    await open(host, roomId);
    expect(await rpc(guest, 'request_room_race_rematch', { p_room_id: roomId })).toEqual({ ok: false, reason: 'not_finished' });

    // House seats span the host's rooms; empty the house before the next room.
    await deleteRoomsHostedBy([hostId]);
    const done = await finishedRoom();
    // The third member needs a phone in this room to be a (non-player) member.
    const [{ join_token }] = await executeSql(`SELECT join_token FROM public.rooms WHERE id = $1`, [done.roomId]);
    expect((await rpc(third, 'join_room', { p_join_token: join_token, p_device_id: newDevice() })).ok).toBe(true);
    expect(await rpc(host, 'answer_room_race_rematch', { p_room_id: done.roomId, p_accept: true })).toEqual({ ok: false, reason: 'no_request' });
    await rpc(guest, 'request_room_race_rematch', { p_room_id: done.roomId });
    expect(await rpc(guest, 'answer_room_race_rematch', { p_room_id: done.roomId, p_accept: true })).toEqual({ ok: false, reason: 'own_request' });
    expect(await rpc(third, 'request_room_race_rematch', { p_room_id: done.roomId })).toEqual({ ok: false, reason: 'not_a_player' });
    expect(await links(done.roomId)).toHaveLength(1);
  });

  it('deny clears the request and makes no race', async () => {
    const { roomId } = await finishedRoom();
    await rpc(host, 'request_room_race_rematch', { p_room_id: roomId });
    expect(await rpc(guest, 'answer_room_race_rematch', { p_room_id: roomId, p_accept: false })).toEqual({ ok: true, state: 'denied' });
    const ls = await links(roomId);
    expect(ls).toHaveLength(1);
    expect(ls[0].rematch_requested_by).toBeNull();
  });

  it('a link with owns_race = false is deleted → the race survives', async () => {
    const { roomId } = await raceRoom();
    const { race_id } = await open(host, roomId);
    strayRaces.push(race_id);
    await executeSql(`UPDATE public.${TABLE} SET owns_race = false WHERE room_id = $1`, [roomId]);
    await executeSql(`DELETE FROM public.${TABLE} WHERE room_id = $1`, [roomId]);
    expect(await race(race_id)).toBeTruthy();
  });

  it('a signed-in client cannot delete (or insert) a room_races row directly', async () => {
    const { roomId } = await raceRoom();
    const { race_id } = await open(host, roomId);
    const del = await host.from(TABLE).delete().eq('room_id', roomId);
    expect(del.error?.code).toBe('42501');
    const ins = await host.from(TABLE).insert({ room_id: roomId, race_id, seq: 9 });
    expect(ins.error?.code).toBe('42501');
    expect(await links(roomId)).toHaveLength(1);
    expect(await race(race_id)).toBeTruthy();
  });

  it('close_room → no room_races, races, race_games or race_confirmations left for that room', async () => {
    const { roomId, raceId } = await finishedRoom();
    await rpc(guest, 'request_room_race_rematch', { p_room_id: roomId });
    const acc = await rpc(host, 'answer_room_race_rematch', { p_room_id: roomId, p_accept: true });
    const ids = [raceId, acc.race_id as string];
    const [before] = await executeSql(`SELECT count(*)::int AS n FROM public.race_confirmations WHERE race_id = ANY($1::uuid[])`, [ids]);
    expect(before.n).toBeGreaterThan(0);

    expect(await rpc(host, 'close_room', { p_room_id: roomId })).toEqual({ ok: true });

    const [left] = await executeSql(
      `SELECT (SELECT count(*) FROM public.${TABLE} WHERE room_id = $1)::int AS links,
              (SELECT count(*) FROM public.races WHERE id = ANY($2::uuid[]))::int AS races,
              (SELECT count(*) FROM public.race_games WHERE race_id = ANY($2::uuid[]))::int AS games,
              (SELECT count(*) FROM public.race_confirmations WHERE race_id = ANY($2::uuid[]))::int AS confs`,
      [roomId, ids]
    );
    expect(left).toEqual({ links: 0, races: 0, games: 0, confs: 0 });
  });
});
