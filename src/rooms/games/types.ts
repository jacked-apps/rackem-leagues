/**
 * @fileoverview The plug-in contract between the Game Room and a game.
 *
 * The room owns three things a game never sees: the phones, the channel, and
 * the wipe. A game owns three things the room never sees: its columns, its
 * screens, its rules. This file is the seam.
 *
 * A game plugs in by adding a `GameDefinition` to `registry.ts` and a folder
 * under `src/rooms/games/<key>/`. Touching anything else in `src/rooms/` to
 * make a game work is a ROOM bug (plan: acceptance boundary).
 *
 * The room reads the registry ONLY to render (names, which components). The
 * contract the database enforces is the table list stored on the room row —
 * `create_room` / `set_room_game` verify every listed table exists, carries a
 * `room_id uuid` cascading FK to `rooms`, is published, and has full replica
 * identity. A game's rows are wiped by `room_id` when the room switches games
 * and cascade-deleted when the room dies; the game never cleans up.
 */
import type { ComponentType } from 'react';
import type { Json } from '@/types/database.types';
import type { RoomPhone } from '@/api/queries/rooms';

/** What a game's `Setup` screen receives. It writes settings via `onStart`. */
export interface GameSetupProps {
  roomId: string;
  /** This device's seat. */
  myPhone: RoomPhone;
  /** Every device in the room, present or not. */
  phones: RoomPhone[];
  /** The room's current settings (may be another game's — Setup decides). */
  settings: Record<string, Json>;
  /**
   * Start (or restart) the game with these settings. The room calls
   * `set_room_game`, which WIPES the game's rows first — a fresh start.
   */
  onStart: (settings: Record<string, Json>) => Promise<void>;
}

/**
 * What a game's `Play` screen receives. Everything else — its rows, its RPCs,
 * its rules — the game fetches and owns itself, keying every query with
 * `queryKeys.rooms.table(roomId, table)` so the room's channel can poke it.
 */
export interface GamePlayProps {
  roomId: string;
  myPhone: RoomPhone;
  phones: RoomPhone[];
  settings: Record<string, Json>;
  /** Whether this device may change settings / restart. */
  isHost: boolean;
}

/** One game the room can host. */
export interface GameDefinition {
  /** Stored on `rooms.game_key`. Stable; never rename once rooms exist. */
  key: string;
  /** Shown in the picker and the room header. */
  name: string;
  /** One line under the name in the picker. */
  description: string;
  /** The tables the game's rows live in — the plug-in contract (cap 3). */
  tables: readonly string[];
  /** Renders when the room has this game but its settings say "not started". */
  Setup: ComponentType<GameSetupProps>;
  /** The game itself. */
  Play: ComponentType<GamePlayProps>;
  /**
   * Has `Setup` run? The room shows `Setup` until this says yes, then `Play`.
   * A game with nothing to set up returns true always.
   */
  isReady: (settings: Record<string, Json>) => boolean;
}
