/**
 * @fileoverview Every way a room-race RPC can say no, as a sentence.
 *
 * Most are races between two phones (the other one got there first) or a room
 * that changed under us, and read that way — nothing here is the player's
 * fault. The settings refusals mean the room was made without the race's
 * defaults; the fix is a new room, so the copy says so.
 */
import type { RoomRaceRefusal } from './roomRaceApi';

export function roomRaceRefusalCopy(reason: RoomRaceRefusal): string {
  switch (reason) {
    case 'not_signed_in':
      return 'Sign in to race.';
    case 'not_found':
      return 'This room is gone.';
    case 'not_in_room':
      return "You're not in this room any more — join again from the invite.";
    case 'need_opponent':
      return 'A race takes two players. Invite someone in and it starts here.';
    case 'missing_setting':
    case 'bad_goal':
    case 'bad_break_rule':
    case 'bad_game_type':
      return "This room's race settings are incomplete. Start a new Race room.";
    case 'no_race':
      return 'There is no race in this room yet.';
    case 'not_a_player':
      return 'Only the two players can run it back.';
    case 'not_finished':
      return 'Finish this race first.';
    case 'no_request':
      return 'Nobody asked to run it back — it may have been answered already.';
    case 'own_request':
      return 'You asked — the other player answers.';
    case 'bad_answer':
      return 'Accept or deny.';
    default:
      return 'That didn’t go through — try again.';
  }
}
