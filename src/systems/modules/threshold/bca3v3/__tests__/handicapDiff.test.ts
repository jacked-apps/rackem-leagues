/**
 * @fileoverview Tests for bca3v3.handicapDiff.
 */

import { describe, it, expect } from 'vitest';
import { handicapDiff } from '../handicapDiff';
import type { StateBag } from '@/systems/chain-runtime/types';

describe('bca3v3.handicapDiff', () => {
  it('computes signed diffs from handicaps + team bonus', async () => {
    const bag: StateBag = {
      home_handicaps: [0, 1, -1],
      away_handicaps: [2, 0, 0],
      home_team_bonus: 2,
      away_team_bonus: 0,
    };
    await handicapDiff.run(bag, {});
    // home total = 0 + 1 - 1 + 2 = 2
    // away total = 2 + 0 + 0 + 0 = 2
    expect(bag.home_handicap_diff).toBe(0);
    expect(bag.away_handicap_diff).toBe(0);
  });

  it('home_diff and away_diff are sign-mirrors', async () => {
    const bag: StateBag = {
      home_handicaps: [2, 2, 2],
      away_handicaps: [0, 0, 0],
      home_team_bonus: 0,
      away_team_bonus: 0,
    };
    await handicapDiff.run(bag, {});
    expect(bag.home_handicap_diff).toBe(6);
    expect(bag.away_handicap_diff).toBe(-6);
  });

  it('zero handicaps and no bonus produce zero diffs', async () => {
    const bag: StateBag = {
      home_handicaps: [0, 0, 0],
      away_handicaps: [0, 0, 0],
      home_team_bonus: 0,
      away_team_bonus: 0,
    };
    await handicapDiff.run(bag, {});
    expect(bag.home_handicap_diff).toBe(0);
    expect(bag.away_handicap_diff).toBe(0);
  });

  it('handles missing bag entries gracefully (treats as 0)', async () => {
    const bag: StateBag = {};
    await handicapDiff.run(bag, {});
    expect(bag.home_handicap_diff).toBe(0);
    expect(bag.away_handicap_diff).toBe(0);
  });

  it('team bonus applied only to home (away_team_bonus default 0)', async () => {
    const bag: StateBag = {
      home_handicaps: [1, 1, 1],
      away_handicaps: [1, 1, 1],
      home_team_bonus: 2,
      away_team_bonus: 0,
    };
    await handicapDiff.run(bag, {});
    // home = 3 + 2 = 5, away = 3 + 0 = 3 → diff = 2
    expect(bag.home_handicap_diff).toBe(2);
    expect(bag.away_handicap_diff).toBe(-2);
  });
});
