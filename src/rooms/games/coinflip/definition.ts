/**
 * @fileoverview The coin flip as a room tenant — the registry entry.
 *
 * `tables` is the plug-in contract: `create_room` verifies `room_coin_flips`
 * exists, cascades from rooms, is published, and has full replica identity.
 * No `Setup`: who calls is a per-flip choice made inside `Play`, so the room
 * has nothing to configure and `isReady` is always true.
 */
import type { GameDefinition } from '../types';
import { COIN_FLIP_TABLE } from './coinFlipApi';
import { RoomCoinFlip } from './RoomCoinFlip';

export const COIN_FLIP: GameDefinition = {
  key: 'coin_flip',
  name: 'Coin flip',
  description: 'One phone calls, the other throws. The house picks the face.',
  tables: [COIN_FLIP_TABLE],
  Play: RoomCoinFlip,
  isReady: () => true,
};
