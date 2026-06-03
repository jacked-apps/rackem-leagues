/**
 * @fileoverview Tests for seedMatchFormat.
 */

import { describe, it, expect } from 'vitest';
import { seedMatchFormat } from '../seedMatchFormat';
import type { StateBag } from '@/systems/chain-runtime/types';

describe('seedMatchFormat', () => {
  it('writes lineup_size, game_generation, total_games (single round robin)', async () => {
    const bag: StateBag = {};
    await seedMatchFormat.run(bag, {
      prefs: { lineupSize: 3, gameGeneration: 'single_round_robin' },
    });
    expect(bag.lineup_size).toBe(3);
    expect(bag.game_generation).toBe('single_round_robin');
    expect(bag.total_games).toBe(9); // 3 * 3 * 1
  });

  it('writes lineup_size, game_generation, total_games (double round robin)', async () => {
    const bag: StateBag = {};
    await seedMatchFormat.run(bag, {
      prefs: { lineupSize: 3, gameGeneration: 'double_round_robin' },
    });
    expect(bag.lineup_size).toBe(3);
    expect(bag.game_generation).toBe('double_round_robin');
    expect(bag.total_games).toBe(18); // 3 * 3 * 2
  });

  it('computes total_games correctly for 5v5 single round robin', async () => {
    const bag: StateBag = {};
    await seedMatchFormat.run(bag, {
      prefs: { lineupSize: 5, gameGeneration: 'single_round_robin' },
    });
    expect(bag.total_games).toBe(25); // 5 * 5 * 1
  });

  it('writes defaults when prefs is missing', async () => {
    const bag: StateBag = {};
    await seedMatchFormat.run(bag, {});
    expect(bag.lineup_size).toBe(0);
    expect(bag.game_generation).toBe('single_round_robin');
    expect(bag.total_games).toBe(0);
  });

  it('writes 0 total_games when lineup_size is 0', async () => {
    const bag: StateBag = {};
    await seedMatchFormat.run(bag, {
      prefs: { lineupSize: 0, gameGeneration: 'double_round_robin' },
    });
    expect(bag.total_games).toBe(0);
  });

  it('never throws on null prefs', () => {
    const bag: StateBag = {};
    expect(() => seedMatchFormat.run(bag, { prefs: null })).not.toThrow();
  });
});
