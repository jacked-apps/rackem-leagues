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
import { isProduction } from '@/config/environment';
import { COIN_FLIP } from './coinflip/definition';
import { RACE } from './race/definition';

/** Tables the room owns; a game may never list them. Mirrors `create_room`. */
export const RESERVED_TABLES: readonly string[] = ['rooms', 'room_phones'];

/** How many tables one game may bring. A dial; mirrors the RPC's cap. */
export const MAX_GAME_TABLES = 3;

/**
 * The largest occupancy a game may declare for one room — mirrors
 * `room_occupancy_cap()`. A sanity ceiling, not a product limit: in practice
 * the binding constraint is the host's house seats.
 */
export const MAX_ROOM_SCREENS = 8;

/**
 * The registered games, in picker order.
 *
 * GATED: Race is listed only off production, until Ed signs it off on staging
 * (CLAUDE.md feature-gating workflow). The gate lives HERE, where the entry is
 * created, so every door — the create dialog's picker and an existing room's
 * `GameSlot` — closes with it. Read per call (not at import) so the
 * environment flag is the one in force when asked.
 */
function games(): Record<string, GameDefinition> {
  const list: GameDefinition[] = [COIN_FLIP];
  if (!isProduction) list.push(RACE);
  return Object.fromEntries(list.map((g) => [g.key, g]));
}

/** The game behind a room row's `game_key`, or undefined for an unknown key. */
export function getGame(key: string): GameDefinition | undefined {
  return games()[key];
}

/** Every game, in picker order. */
export function listGames(): GameDefinition[] {
  return Object.values(games());
}

/** The name to show for a key — falls back to the key so nothing renders blank. */
export function gameName(key: string): string {
  return getGame(key)?.name ?? key;
}
