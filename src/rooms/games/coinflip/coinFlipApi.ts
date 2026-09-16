/**
 * @fileoverview The two-phone coin flip's reads and writes — the game's own,
 * living in the game's folder. The room never imports this.
 *
 * One read: the room's LATEST flip row. Three writes, all RPCs, because the
 * flip's trust lives in the database: `start_room_coin_flip` makes a row
 * between two phones, `call_room_coin` records the caller phone's side (until
 * the throw), `throw_room_coin` has the database pick the face for the
 * flipper phone — exactly once. See
 * supabase/migrations/20260916200041_room_coin_flips.sql.
 *
 * Every RPC returns `{ok, reason?}`; only a transport failure throws.
 */
import { supabase } from '@/supabaseClient';
import type { Json, Tables } from '@/types/database.types';
import type { Call, Face } from '@/components/coinflip/types';

/** The table this game brings — the plug-in contract entry. */
export const COIN_FLIP_TABLE = 'room_coin_flips';

/** A flip row as the screen reads it. */
export type RoomCoinFlipRow = Omit<Tables<'room_coin_flips'>, 'call' | 'face'> & {
  call: Call | null;
  face: Face | null;
};

/** Every reason a flip RPC can refuse. */
export type CoinFlipRefusal =
  | 'not_signed_in'
  | 'not_found'
  | 'same_phone'
  | 'phone_not_in_room'
  | 'not_in_flip'
  | 'not_caller'
  | 'not_flipper'
  | 'bad_call'
  | 'no_call'
  | 'already_thrown';

export type CoinFlipResult<T = object> = ({ ok: true } & T) | { ok: false; reason: CoinFlipRefusal };

/** The room's latest flip, or null before the first one. */
export async function getLatestRoomFlip(roomId: string): Promise<RoomCoinFlipRow | null> {
  const { data, error } = await supabase
    .from('room_coin_flips')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load the flip: ${error.message}`);
  return (data as RoomCoinFlipRow | null) ?? null;
}

async function call<T>(fn: string, args: Record<string, Json | undefined>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as (
    name: string,
    params: unknown
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

/** A fresh flip between two phones in the room; the caller must be one of them. */
export function startRoomCoinFlip(roomId: string, callerPhoneId: string, flipperPhoneId: string) {
  return call<CoinFlipResult<{ flip_id: string }>>('start_room_coin_flip', {
    p_room_id: roomId,
    p_caller_phone_id: callerPhoneId,
    p_flipper_phone_id: flipperPhoneId,
  });
}

/** The caller phone names a side. Changeable until the throw. */
export function callRoomCoin(flipId: string, side: Call) {
  return call<CoinFlipResult>('call_room_coin', { p_flip_id: flipId, p_call: side });
}

/** The flipper phone throws; the database picks the face. */
export function throwRoomCoin(flipId: string) {
  return call<CoinFlipResult<{ face: Face }>>('throw_room_coin', { p_flip_id: flipId });
}
