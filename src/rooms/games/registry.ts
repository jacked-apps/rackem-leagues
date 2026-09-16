/**
 * @fileoverview `gameKey → GameDefinition` — every game the room can host.
 *
 * Code-side today; data-side later, the same journey scoring systems are on.
 * The room reads this only to render. Adding an entry here plus a folder
 * under `games/` is the WHOLE act of plugging a game in.
 *
 * An entry lands with its migration: `create_room` refuses a table the
 * database does not have, so the two ship together (the coin flip did).
 */
import type { GameDefinition } from './types';
import { COIN_FLIP } from './coinflip/definition';

/** Tables the room owns; a game may never list them. Mirrors `create_room`. */
export const RESERVED_TABLES: readonly string[] = ['rooms', 'room_phones'];

/** How many tables one game may bring. A dial; mirrors the RPC's cap. */
export const MAX_GAME_TABLES = 3;

const GAMES: Record<string, GameDefinition> = {
  [COIN_FLIP.key]: COIN_FLIP,
};

/** The game behind a room row's `game_key`, or undefined for an unknown key. */
export function getGame(key: string): GameDefinition | undefined {
  return GAMES[key];
}

/** Every game, in picker order. */
export function listGames(): GameDefinition[] {
  return Object.values(GAMES);
}

/** The name to show for a key — falls back to the key so nothing renders blank. */
export function gameName(key: string): string {
  return getGame(key)?.name ?? key;
}
