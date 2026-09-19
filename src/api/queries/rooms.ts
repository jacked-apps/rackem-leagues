/**
 * @fileoverview Read operations for the Game Room.
 *
 * The room's reads are two RPCs that return one jsonb shape — `room_state`:
 * the room row, derived seats, and every device with a SERVER-computed
 * `is_present` (so a phone with a skewed clock never disagrees with the seat
 * count). `{found:false}` means the room is gone (closed or swept); callers
 * get `null` and render "this room has ended" — never an error.
 *
 * See supabase/migrations/20260916171612_game_rooms.sql.
 */
import { supabase } from '@/supabaseClient';
import type { Json } from '@/types/database.types';

/** The room row as the pages see it. `settings` is opaque to the room. */
export interface RoomRow {
  id: string;
  host_member_id: string;
  game_key: string;
  game_tables: string[];
  settings: Record<string, Json>;
  shared: boolean;
  join_token: string;
  last_activity_at: string;
  created_at: string;
}

/**
 * The seat picture (house model): seats belong to the room's OWNER and span
 * every room they own. `devices` is THIS room's present devices; `guests` /
 * `seats` / `open` are the owner's house — distinct people present across all
 * their rooms, the dial (3), and what is left.
 */
export interface RoomSeats {
  devices: number;
  guests: number;
  seats: number;
  open: number;
}

/** One device in the room. A member on two devices is two of these. */
export interface RoomPhone {
  id: string;
  member_id: string;
  device_id: string;
  display_name: string;
  is_host: boolean;
  is_present: boolean;
  last_seen_at: string;
  joined_at: string;
}

/** The whole picture, as `room_state` builds it. */
export interface RoomState {
  room: RoomRow;
  seats: RoomSeats;
  phones: RoomPhone[];
}

type RoomStateRpc = ({ found: true } & RoomState) | { found: false };

function unwrap(data: unknown): RoomState | null {
  const r = data as RoomStateRpc | null;
  if (!r || !r.found) return null;
  const { room, seats, phones } = r;
  return { room, seats, phones };
}

/** A room by id, or null once it is gone. */
export async function getRoom(roomId: string): Promise<RoomState | null> {
  const { data, error } = await supabase.rpc('get_room', { p_room_id: roomId });
  if (error) throw new Error(`Failed to load room: ${error.message}`);
  return unwrap(data);
}

/** A room by its link/QR token (the join page), or null once it is gone. */
export async function getRoomByToken(joinToken: string): Promise<RoomState | null> {
  const { data, error } = await supabase.rpc('get_room_by_token', { p_join_token: joinToken });
  if (error) throw new Error(`Failed to load room: ${error.message}`);
  return unwrap(data);
}

/** A room the member has a device in, as listed on the rooms index. */
export interface MyRoom {
  room_id: string;
  game_key: string;
  shared: boolean;
  is_host: boolean;
  joined_at: string;
}

/**
 * Rooms the member currently has a device in — the "rejoin" list. Reads
 * `rooms` through its phones (inner join on the member), so a swept room —
 * whose phones are gone with it — is never listed. One entry per room even
 * when the member has several devices in it.
 */
export async function getMyRooms(memberId: string): Promise<MyRoom[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, game_key, shared, room_phones!inner(member_id, is_host, joined_at)')
    .eq('room_phones.member_id', memberId);
  if (error) throw new Error(`Failed to load your rooms: ${error.message}`);

  return (data ?? [])
    .map((r) => {
      const mine = r.room_phones;
      return {
        room_id: r.id,
        game_key: r.game_key,
        shared: r.shared,
        is_host: mine.some((p) => p.is_host),
        joined_at: mine.map((p) => p.joined_at).sort()[0] ?? '',
      };
    })
    .sort((x, y) => (x.joined_at < y.joined_at ? 1 : -1));
}
