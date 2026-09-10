/**
 * @fileoverview Row and view-model types for a race.
 *
 * A race is two players playing games until one reaches their goal. It carries
 * everything its own loop needs and points at no parent — a bracket match, a
 * league pairing, or nothing at all can point AT a race, and the race is
 * unchanged either way.
 *
 * `RaceSeat` is the shape the room is HANDED rather than works out. Who the two
 * people are, which side each is on, and what to call them are resolved by
 * whoever is hosting the race — a tournament resolves them from bracket seats, a
 * league from a lineup and two teams. Nothing below reaches out to find them.
 */

import type { Database } from '@/types/database.types';

export type Race = Database['public']['Tables']['races']['Row'];
export type RaceGame = Database['public']['Tables']['race_games']['Row'];
export type RaceConfirmation = Database['public']['Tables']['race_confirmations']['Row'];

/** Which end of the race someone sits on. Always these two literal words. */
export type RaceSide = 'home' | 'away';

/** One of the two players, as the room needs them: a name, a side, an id. */
export interface RaceSeat {
  memberId: string;
  side: RaceSide;
  /** What to show. The host decides whether that's a nickname or a full name. */
  displayName: string;
  /** Games this player must win to take the race. Independent per side. */
  goal: number;
}

/** Everything the room renders from, with nothing left to derive. */
export interface RaceView {
  race: Race;
  home: RaceSeat;
  away: RaceSeat;
  games: RaceGame[];
  confirmations: RaceConfirmation[];
  /** The viewer's side, or null if they are watching rather than playing. */
  mySide: RaceSide | null;
  homeWon: number;
  awayWon: number;
  /**
   * The only game a result may be entered on — the earliest one not yet
   * settled by both players. Null when the race is finished or not started.
   */
  activeGameNumber: number | null;
  /**
   * The only game that may be wiped — the last one with a result. A race is
   * linear: to fix game 3 of 5 you reverse 5, then 4, then 3.
   */
  vacatableGameNumber: number | null;
}

/** True once both players have agreed a game's result. */
export function isSettled(game: RaceGame): boolean {
  return (
    game.winner_player_id !== null &&
    game.confirmed_by_home !== null &&
    game.confirmed_by_away !== null
  );
}

/** Which side won a game, or null if it has no result yet. */
export function winnerSideOf(game: RaceGame, race: Race): RaceSide | null {
  if (!game.winner_player_id) return null;
  return game.winner_player_id === race.home_member_id ? 'home' : 'away';
}
