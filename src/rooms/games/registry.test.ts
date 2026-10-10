/**
 * @fileoverview Tests for the game registry — the lookup, the fallback name,
 * and the plug-in contract every registered game must honour (mirrors what
 * `create_room` enforces, so a bad entry fails here before it fails there).
 */
import { describe, it, expect } from 'vitest';
import {
  gameName,
  getGame,
  listGames,
  MAX_GAME_TABLES,
  MAX_ROOM_SCREENS,
  RESERVED_TABLES,
} from './registry';

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
});
