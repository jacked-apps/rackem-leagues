/**
 * @fileoverview Tests for bca5v5 threshold modules (handicapDiff,
 * homeThresholds, awayThresholds). 5v5 Percentage uses the 5v5 chart
 * and has NO team bonus.
 */

import { describe, it, expect } from 'vitest';
import { handicapDiff } from '../handicapDiff';
import { homeThresholds } from '../homeThresholds';
import { awayThresholds } from '../awayThresholds';
import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';
import type { StateBag } from '@/systems/chain-runtime/types';

describe('bca5v5.handicapDiff', () => {
  it('computes signed diffs from handicaps (no team bonus)', async () => {
    const bag: StateBag = {
      home_handicaps: [50, 60, 55, 70, 45], // sum = 280
      away_handicaps: [40, 65, 50, 55, 60], // sum = 270
    };
    await handicapDiff.run(bag, {});
    expect(bag.home_handicap_diff).toBe(10);
    expect(bag.away_handicap_diff).toBe(-10);
  });

  it('ignores any team_bonus keys (percentage has no bonus)', async () => {
    const bag: StateBag = {
      home_handicaps: [10, 10, 10, 10, 10],
      away_handicaps: [10, 10, 10, 10, 10],
      home_team_bonus: 99, // should be ignored
      away_team_bonus: 99,
    };
    await handicapDiff.run(bag, {});
    expect(bag.home_handicap_diff).toBe(0);
    expect(bag.away_handicap_diff).toBe(0);
  });

  it('writes 0/0 when handicaps are missing', async () => {
    const bag: StateBag = {};
    await handicapDiff.run(bag, {});
    expect(bag.home_handicap_diff).toBe(0);
    expect(bag.away_handicap_diff).toBe(0);
  });
});

describe('bca5v5.homeThresholds', () => {
  it('writes the 5v5 chart trio for a given home_handicap_diff', async () => {
    const bag: StateBag = { home_handicap_diff: 10 };
    await homeThresholds.run(bag, {});
    const expected = get5v5GamesNeeded(10);
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

describe('bca5v5.awayThresholds', () => {
  it('writes the 5v5 chart trio for a given away_handicap_diff', async () => {
    const bag: StateBag = { away_handicap_diff: -10 };
    await awayThresholds.run(bag, {});
    const expected = get5v5GamesNeeded(-10);
    expect(bag.away_to_win).toBe(expected.games_to_win);
    expect(bag.away_to_tie).toBe(expected.games_to_tie);
    expect(bag.away_to_lose).toBe(expected.games_to_lose);
  });
});
