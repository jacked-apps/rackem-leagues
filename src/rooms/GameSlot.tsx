/**
 * @fileoverview The slot the room hands to whichever game the row names.
 *
 * The room's only contact with a game: look the key up in the registry, show
 * `Setup` until the game says its settings are ready, then `Play`. An unknown
 * key (a game registered on another machine, a key retired) is a plain notice,
 * never a crash — the room is still a room, the phones are still here.
 *
 * Restarting goes through `set_room_game` with the SAME game, which wipes the
 * game's rows and stores the new settings — so Setup's `onStart` is the same
 * call the host's "switch game" makes, just with the key unchanged.
 */
import type { Json } from '@/types/database.types';
import type { RoomPhone, RoomRow } from '@/api/queries/rooms';
import { getGame } from './games/registry';

interface GameSlotProps {
  room: RoomRow;
  myPhone: RoomPhone;
  phones: RoomPhone[];
  isHost: boolean;
  /** `set_room_game(room, sameKey, sameTables, settings)` — a fresh start. */
  onStart: (settings: Record<string, Json>) => Promise<void>;
}

export function GameSlot({ room, myPhone, phones, isHost, onStart }: GameSlotProps) {
  const game = getGame(room.game_key);

  if (!game) {
    return (
      <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        This room is set to a game this app doesn't know ({room.game_key}). The host can switch games.
      </p>
    );
  }

  const shared = { roomId: room.id, myPhone, phones, settings: room.settings };

  if (game.Setup && !game.isReady(room.settings)) {
    return <game.Setup {...shared} onStart={onStart} />;
  }
  return <game.Play {...shared} isHost={isHost} />;
}
