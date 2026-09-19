/**
 * @fileoverview Every way a room RPC can say no, as a sentence a person can
 * act on. Refusals are ordinary outcomes ("this room is full"), not faults, so
 * none of these should read like an error.
 *
 * Shared by the join page, the create/switch dialog, and the room's host
 * controls so the same refusal never gets three different phrasings.
 */
import type { RoomRefused } from '@/api/mutations/rooms';

/** What `table_not_ready` is missing, in plain words — for the developer who
 *  registered the game, since a player can do nothing about it. */
const MISSING_COPY: Record<NonNullable<RoomRefused['missing']>, string> = {
  table: 'the table does not exist',
  room_id_uuid: 'it has no room_id uuid column',
  cascade_fk: 'room_id is not a cascading foreign key to rooms',
  publication: 'it is not in the realtime publication',
  replica_identity: 'it does not have full replica identity',
};

/**
 * @param r - The refused half of any room RPC result.
 * @returns One sentence.
 */
export function roomRefusalCopy(r: RoomRefused): string {
  switch (r.reason) {
    case 'not_signed_in':
      return 'Sign in to use a room.';
    case 'no_device':
      return 'This browser could not identify itself — try reloading.';
    case 'not_found':
      return 'This room has ended.';
    case 'not_shared':
      return 'This room is private. The host can open the door to invite people.';
    case 'full':
      return `The host's seats are all taken — ${r.hint ?? "a seat frees up when a screen in the host's house closes"}.`;
    case 'not_in_room':
      return "This device isn't in the room yet.";
    case 'not_host':
      return 'Only the host can do that.';
    case 'not_a_host':
      return 'Opening a room to others is a host feature. Ask a league operator to start it.';
    case 'no_game':
      return 'Pick a game first.';
    case 'no_tables':
      return 'That game has no tables registered.';
    case 'too_many_tables':
      return `A game may bring at most ${r.max ?? 3} tables.`;
    case 'duplicate_table':
      return `The game lists ${r.table} twice.`;
    case 'table_reserved':
      return `${r.table} belongs to the room; a game cannot use it.`;
    case 'table_not_ready':
      return `${r.table} is not ready for a room: ${r.missing ? MISSING_COPY[r.missing] : 'unknown'}.`;
    default:
      return 'That didn’t go through — try again.';
  }
}
