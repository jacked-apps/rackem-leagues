/**
 * @fileoverview Tests for the game registry — the lookup, the fallback name,
 * and the plug-in contract every registered game must honour (mirrors what
 * `create_room` enforces, so a bad entry fails here before it fails there).
 */
import { describe, it, expect } from 'vitest';
import { gameName, getGame, listGames, MAX_GAME_TABLES, RESERVED_TABLES } from './registry';

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
      expect(game.Setup).toBeDefined();
      expect(game.Play).toBeDefined();
    }
  });
});
