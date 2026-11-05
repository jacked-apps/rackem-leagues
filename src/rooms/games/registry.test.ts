/**
 * @fileoverview Tests for the game registry — the lookup, the fallback name,
 * the plug-in contract every registered game must honour (mirrors what
 * `create_room` enforces, so a bad entry fails here before it fails there),
 * and the Race gate (listed off production only).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// One mutable flag behind a getter, so each test can flip the environment
// without re-importing the registry (it reads the flag per call).
const env = vi.hoisted(() => ({ production: false }));
vi.mock('@/config/environment', () => ({
  get isProduction() {
    return env.production;
  },
}));
// The Play components are irrelevant to the contract; keep their imports light.
vi.mock('./race/RoomRace', () => ({ RoomRace: () => null }));

import {
  gameName,
  getGame,
  listGames,
  MAX_GAME_TABLES,
  MAX_ROOM_SCREENS,
  RESERVED_TABLES,
} from './registry';

beforeEach(() => {
  env.production = false;
});

describe('registry', () => {
  it('an unknown key is undefined, and its name falls back to the key', () => {
    expect(getGame('not_a_game')).toBeUndefined();
    expect(gameName('not_a_game')).toBe('not_a_game');
  });

  it('every registered game honours the plug-in contract', () => {
    for (const game of listGames()) {
      expect(getGame(game.key)).toBe(game);
      expect(game.name.trim()).not.toBe('');
      expect(game.tables.length).toBeGreaterThan(0);
      expect(game.tables.length).toBeLessThanOrEqual(MAX_GAME_TABLES);
      expect(new Set(game.tables).size).toBe(game.tables.length);
      for (const t of game.tables) expect(RESERVED_TABLES).not.toContain(t);
      expect(typeof game.isReady).toBe('function');
      // Occupancy: a real range the room can store and enforce, within the
      // server's ceiling (room_occupancy_cap).
      expect(game.screens.min).toBeGreaterThanOrEqual(1);
      expect(game.screens.max).toBeGreaterThanOrEqual(game.screens.min);
      expect(game.screens.max).toBeLessThanOrEqual(MAX_ROOM_SCREENS);
      if (!game.Setup) expect(game.isReady({})).toBe(true);
      expect(game.Play).toBeDefined();
    }
  });

  it('the race entry: 2 screens, one table (room_races), defaults carried for create', () => {
    const race = getGame('race');
    expect(race?.name).toBe('Race');
    expect(race?.screens).toEqual({ min: 2, max: 2 });
    expect(race?.tables).toEqual(['room_races']);
    expect(race?.Setup).toBeUndefined();
    expect(race?.defaultSettings).toEqual({ base: 5, break_rule: 'winner_breaks', game_type: 'eight_ball' });
  });

  it('the coin flip entry is unchanged', () => {
    const flip = getGame('coin_flip');
    expect(flip?.tables).toEqual(['room_coin_flips']);
    expect(flip?.screens).toEqual({ min: 2, max: 2 });
    expect(flip?.defaultSettings).toBeUndefined();
  });

  it('gate: non-production lists Race after the coin flip', () => {
    expect(listGames().map((g) => g.key)).toEqual(['coin_flip', 'race']);
  });

  it('gate: production lists no Race — not in the picker, not behind a room key', () => {
    env.production = true;
    expect(listGames().map((g) => g.key)).toEqual(['coin_flip']);
    expect(getGame('race')).toBeUndefined();
  });
});
