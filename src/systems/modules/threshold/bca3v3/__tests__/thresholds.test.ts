/**
 * @fileoverview Tests for bca3v3.{home,away}Thresholds — chart-lookup
 * modules. Compares module output to the underlying chart function
 * (byte-equivalence by construction).
 */

import { describe, it, expect } from 'vitest';
import { homeThresholds } from '../homeThresholds';
import { awayThresholds } from '../awayThresholds';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import type { StateBag } from '@/systems/chain-runtime/types';

describe('bca3v3.homeThresholds', () => {
  it('writes the 3v3 chart trio for a given home_handicap_diff', async () => {
    const bag: StateBag = { home_handicap_diff: 2 };
    await homeThresholds.run(bag, {});
    const expected = get3v3GamesNeeded(2);
    expect(bag.home_to_win).toBe(expected.games_to_win);
    expect(bag.home_to_tie).toBe(expected.games_to_tie);
    expect(bag.home_to_lose).toBe(expected.games_to_lose);
  });

  it('handles 0 diff (even match)', async () => {
    const bag: StateBag = { home_handicap_diff: 0 };
    await homeThresholds.run(bag, {});
    const expected = get3v3GamesNeeded(0);
    expect(bag.home_to_win).toBe(expected.games_to_win);
    expect(bag.home_to_tie).toBe(expected.games_to_tie);
    expect(bag.home_to_lose).toBe(expected.games_to_lose);
  });

  it('handles negative diff', async () => {
    const bag: StateBag = { home_handicap_diff: -3 };
    await homeThresholds.run(bag, {});
    const expected = get3v3GamesNeeded(-3);
    expect(bag.home_to_win).toBe(expected.games_to_win);
    expect(bag.home_to_tie).toBe(expected.games_to_tie);
    expect(bag.home_to_lose).toBe(expected.games_to_lose);
  });

  it('writes nulls when home_handicap_diff is missing', async () => {
    const bag: StateBag = {};
    await homeThresholds.run(bag, {});
    expect(bag.home_to_win).toBeNull();
    expect(bag.home_to_tie).toBeNull();
    expect(bag.home_to_lose).toBeNull();
  });
});

describe('bca3v3.awayThresholds', () => {
  it('writes the 3v3 chart trio for a given away_handicap_diff', async () => {
    const bag: StateBag = { away_handicap_diff: 2 };
    await awayThresholds.run(bag, {});
    const expected = get3v3GamesNeeded(2);
    expect(bag.away_to_win).toBe(expected.games_to_win);
    expect(bag.away_to_tie).toBe(expected.games_to_tie);
    expect(bag.away_to_lose).toBe(expected.games_to_lose);
  });

  it('writes nulls when away_handicap_diff is missing', async () => {
    const bag: StateBag = {};
    await awayThresholds.run(bag, {});
    expect(bag.away_to_win).toBeNull();
    expect(bag.away_to_tie).toBeNull();
    expect(bag.away_to_lose).toBeNull();
  });
});
