/**
 * @fileoverview Tests for seedLineupHandicaps.
 */

import { describe, it, expect } from 'vitest';
import { seedLineupHandicaps } from '../seedLineupHandicaps';
import type { StateBag } from '@/systems/chain-runtime/types';

describe('seedLineupHandicaps', () => {
  it('extracts a 3v3 lineup into a 3-element array', async () => {
    const bag: StateBag = {};
    await seedLineupHandicaps.run(bag, {
      homeLineup: {
        player1_handicap: 0,
        player2_handicap: 1,
        player3_handicap: -1,
      },
      awayLineup: {
        player1_handicap: 2,
        player2_handicap: 0,
        player3_handicap: 0,
      },
    });
    expect(bag.home_handicaps).toEqual([0, 1, -1]);
    expect(bag.away_handicaps).toEqual([2, 0, 0]);
  });

  it('extracts a 5v5 lineup into a 5-element array', async () => {
    const bag: StateBag = {};
    await seedLineupHandicaps.run(bag, {
      homeLineup: {
        player1_handicap: 50,
        player2_handicap: 60,
        player3_handicap: 55,
        player4_handicap: 70,
        player5_handicap: 45,
      },
      awayLineup: {
        player1_handicap: 40,
        player2_handicap: 65,
        player3_handicap: 50,
        player4_handicap: 55,
        player5_handicap: 60,
      },
    });
    expect(bag.home_handicaps).toEqual([50, 60, 55, 70, 45]);
    expect(bag.away_handicaps).toEqual([40, 65, 50, 55, 60]);
  });

  it('filters out null/undefined slots', async () => {
    const bag: StateBag = {};
    await seedLineupHandicaps.run(bag, {
      homeLineup: {
        player1_handicap: 1,
        player2_handicap: null,
        player3_handicap: 2,
        player4_handicap: undefined,
        player5_handicap: 3,
      },
      awayLineup: {
        player1_handicap: 4,
      },
    });
    expect(bag.home_handicaps).toEqual([1, 2, 3]);
    expect(bag.away_handicaps).toEqual([4]);
  });

  it('writes empty arrays when lineups are missing', async () => {
    const bag: StateBag = {};
    await seedLineupHandicaps.run(bag, {});
    expect(bag.home_handicaps).toEqual([]);
    expect(bag.away_handicaps).toEqual([]);
  });

  it('writes empty arrays when lineups are null', async () => {
    const bag: StateBag = {};
    await seedLineupHandicaps.run(bag, { homeLineup: null, awayLineup: null });
    expect(bag.home_handicaps).toEqual([]);
    expect(bag.away_handicaps).toEqual([]);
  });

  it('never throws on garbage input', () => {
    const bag: StateBag = {};
    expect(() => seedLineupHandicaps.run(bag, {})).not.toThrow();
  });
});
