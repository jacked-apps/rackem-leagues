/**
 * @fileoverview The race as a room tenant — the registry entry.
 *
 * `tables` is the plug-in contract: `create_room` verifies `room_races` exists,
 * cascades from rooms, is published, and has full replica identity. The race
 * tables themselves point at nobody; the room owns the link rows, and closing
 * the room takes its races with it.
 *
 * No `Setup`: the race's settings come from `defaultSettings` (base 5, winner
 * breaks, 8-ball) written onto the room at create, and who breaks is agreed
 * inside `Play` by the race itself.
 */
import type { GameDefinition } from '../types';
import { RACE_DEFAULT_SETTINGS } from './raceDefaults';
import { ROOM_RACES_TABLE } from './roomRaceApi';
import { RoomRace } from './RoomRace';

export const RACE: GameDefinition = {
  key: 'race',
  name: 'Race',
  description: 'One against one, first to the goal. Both phones score and confirm.',
  tables: [ROOM_RACES_TABLE],
  // Exactly two: a race is one player against one other. A third screen can
  // still watch a race it joined late, but the room does not seat one.
  screens: { min: 2, max: 2 },
  Play: RoomRace,
  isReady: () => true,
  defaultSettings: RACE_DEFAULT_SETTINGS,
};
