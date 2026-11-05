/**
 * @fileoverview The room race's reads and writes — the game's own, living in
 * the game's folder. The room never imports this.
 *
 * One read: the room's link rows (`room_races`, one per race played here) with
 * each race's result. Three writes, all RPCs, because who plays and when the
 * next race exists is decided in the database under the room lock — see
 * supabase/migrations/20261103161418_room_races.sql.
 *
 * Every RPC returns `{ok, reason?}`; only a transport failure throws.
 */
import { supabase } from '@/supabaseClient';
import type { Json } from '@/types/database.types';
import type { Race, RaceGame } from '@/race/types';

/** The table this game brings — the plug-in contract entry. */
export const ROOM_RACES_TABLE = 'room_races';

/** One race played in this room, with what the earlier-races list needs. */
export interface RoomRaceLink {
  id: string;
  race_id: string;
  /** 1 = the first race, 2 = the first Run it back, … */
  seq: number;
  /** The member waiting on an answer to "Run it back", or null. */
  rematch_requested_by: string | null;
  race: (Pick<Race, 'status' | 'home_member_id' | 'away_member_id' | 'winner_player_id'> & {
    race_games: Pick<RaceGame, 'winner_player_id' | 'confirmed_by_home' | 'confirmed_by_away'>[];
  }) | null;
}

/** Every reason a room-race RPC can refuse. */
export type RoomRaceRefusal =
  | 'not_signed_in' | 'not_found' | 'not_in_room' | 'need_opponent'
  | 'missing_setting' | 'bad_goal' | 'bad_break_rule' | 'bad_game_type'
  | 'no_race' | 'not_a_player' | 'not_finished'
  | 'bad_answer' | 'no_request' | 'own_request';

export type RoomRaceResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: RoomRaceRefusal; setting?: string };

/** What open / an accept hands back: the race to show. */
export type RaceRef = { race_id: string; seq: number };

/** The room's races in play order (oldest first). */
export async function listRoomRaces(roomId: string): Promise<RoomRaceLink[]> {
  const { data, error } = await supabase
    .from('room_races')
    .select('id, race_id, seq, rematch_requested_by, race:races(status, home_member_id, away_member_id, winner_player_id, race_games(winner_player_id, confirmed_by_home, confirmed_by_away))')
    .eq('room_id', roomId)
    .order('seq', { ascending: true });
  if (error) throw new Error(`Failed to load the room's races: ${error.message}`);
  return (data ?? []) as unknown as RoomRaceLink[];
}

async function call<T>(fn: string, args: Record<string, Json | undefined>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as (
    name: string,
    params: unknown
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

/** The room's latest race; the first call (either phone) creates race 1. */
export function openRoomRace(roomId: string) {
  return call<RoomRaceResult<RaceRef & { created: boolean }>>('open_room_race', { p_room_id: roomId });
}

/** A player of the finished latest race asks to Run it back. */
export function requestRoomRaceRematch(roomId: string) {
  return call<RoomRaceResult<{ state: 'requested' } | ({ state: 'accepted' } & RaceRef)>>(
    'request_room_race_rematch', { p_room_id: roomId });
}

/** The other player answers a pending Run it back. */
export function answerRoomRaceRematch(roomId: string, accept: boolean) {
  return call<RoomRaceResult<{ state: 'denied' } | ({ state: 'accepted' } & RaceRef)>>(
    'answer_room_race_rematch', { p_room_id: roomId, p_accept: accept });
}
