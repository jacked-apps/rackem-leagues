/**
 * @fileoverview Write operations for the Game Room — thin wrappers over the
 * SECURITY DEFINER RPCs in supabase/migrations/20260916171612_game_rooms.sql.
 *
 * Every RPC returns `{ok, reason?, ...}` rather than raising, so a page can
 * phrase every outcome ("this room is full", "open the door to invite").
 * Only a TRANSPORT failure throws. The caller is always resolved server-side
 * from `auth.uid()` — no identity is ever passed in.
 *
 * A seat is a DEVICE: `deviceId` comes from `src/rooms/deviceId.ts`, minted
 * once per browser.
 */
import { supabase } from '@/supabaseClient';
import type { Json } from '@/types/database.types';
import type { RoomSeats } from '@/api/queries/rooms';

/** Every reason a room RPC can refuse. Pages map these to copy. */
export type RoomRefusal =
  | 'not_signed_in'
  | 'no_device'
  | 'no_game'
  | 'not_a_host'
  | 'not_host'
  | 'not_found'
  | 'not_shared'
  | 'not_in_room'
  | 'full'
  | 'no_tables'
  | 'too_many_tables'
  | 'duplicate_table'
  | 'table_reserved'
  | 'table_not_ready';

/** The refused half of any room RPC result. */
export interface RoomRefused {
  ok: false;
  reason: RoomRefusal;
  /** `table_not_ready` / `table_reserved` / `duplicate_table` name the table … */
  table?: string;
  /** … and `table_not_ready` says what it lacks. */
  missing?: 'table' | 'room_id_uuid' | 'cascade_fk' | 'publication' | 'replica_identity';
  /** `full` carries the seat picture and a hint for the copy. */
  seats?: RoomSeats;
  hint?: string;
  /** `too_many_tables` says the cap. */
  max?: number;
}

export type CreateRoomResult = { ok: true; room_id: string; join_token: string } | RoomRefused;
export type JoinRoomResult = { ok: true; room_id: string; phone_id: string; rejoined: boolean } | RoomRefused;
export type RoomOkResult = { ok: true } | RoomRefused;

async function call<T>(fn: string, args: Record<string, Json | undefined>): Promise<T> {
  // The generated types narrow `fn`; every name here is real. The cast keeps
  // one call site instead of nine near-identical ones.
  const { data, error } = await (supabase.rpc as unknown as (
    name: string,
    params: unknown
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

export interface CreateRoomParams {
  gameKey: string;
  /** The game's tables — validated server-side against the plug-in contract. */
  tables: string[];
  deviceId: string;
  settings?: Record<string, Json>;
  /** false = free room (one device, no channel). true needs the host gate. */
  shared?: boolean;
}

/** The caller becomes host + first device. */
export function createRoom(p: CreateRoomParams): Promise<CreateRoomResult> {
  return call('create_room', {
    p_game_key: p.gameKey,
    p_tables: p.tables,
    p_device_id: p.deviceId,
    p_settings: p.settings ?? {},
    p_shared: p.shared ?? false,
  });
}

/** This device takes a seat. Same device again = a refresh, not a new seat. */
export function joinRoom(joinToken: string, deviceId: string): Promise<JoinRoomResult> {
  return call('join_room', { p_join_token: joinToken, p_device_id: deviceId });
}

/** "This device is still here." Best-effort; a missed beat is not a failure. */
export function roomHeartbeat(roomId: string, deviceId: string): Promise<RoomOkResult> {
  return call('room_heartbeat', { p_room_id: roomId, p_device_id: deviceId });
}

/** Host: a NEW game — validates the tables, WIPES the old game's rows, updates. */
export function setRoomGame(
  roomId: string,
  gameKey: string,
  tables: string[],
  settings: Record<string, Json> = {}
): Promise<RoomOkResult> {
  return call('set_room_game', {
    p_room_id: roomId,
    p_game_key: gameKey,
    p_tables: tables,
    p_settings: settings,
  });
}

/** Host: change the game's settings mid-play WITHOUT wiping. */
export function setRoomSettings(roomId: string, settings: Record<string, Json>): Promise<RoomOkResult> {
  return call('set_room_settings', { p_room_id: roomId, p_settings: settings });
}

/** Host: open (true, needs the host gate) or shut the door, in place. */
export function setRoomShared(roomId: string, shared: boolean): Promise<RoomOkResult> {
  return call('set_room_shared', { p_room_id: roomId, p_shared: shared });
}

/** Host: end the room. Cascade removes phones and every game table's rows. */
export function closeRoom(roomId: string): Promise<RoomOkResult> {
  return call('close_room', { p_room_id: roomId });
}
