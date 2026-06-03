/**
 * @fileoverview Tests for fargoGames.thresholds — wraps
 * computeFargoGamesWonThresholds in one bag-write module. Compares
 * module output to the underlying helper (byte-equivalence by
 * construction).
 */

import { describe, it, expect } from 'vitest';
import { thresholds } from '../thresholds';
import { computeFargoGamesWonThresholds } from '@/utils/handicap/fargoGamesWonThresholds';
import type { StateBag } from '@/systems/chain-runtime/types';

describe('fargoGames.thresholds', () => {
  it('writes all six threshold values matching the helper output', async () => {
    const homeRatings = [550, 580, 600, 620, 540];
    const awayRatings = [560, 570, 590, 610, 530];
    const totalGames = 25;
    const expected = computeFargoGamesWonThresholds({
      homeRatings,
      awayRatings,
      totalGames,
    });

    const bag: StateBag = {
      home_handicaps: homeRatings,
      away_handicaps: awayRatings,
      total_games: totalGames,
    };
    await thresholds.run(bag, {});

    expect(bag.home_to_win).toBe(expected.home.games_to_win);
    expect(bag.home_to_tie).toBe(expected.home.games_to_tie);
    expect(bag.home_to_lose).toBe(expected.home.games_to_lose);
    expect(bag.away_to_win).toBe(expected.away.games_to_win);
    expect(bag.away_to_tie).toBe(expected.away.games_to_tie);
    expect(bag.away_to_lose).toBe(expected.away.games_to_lose);
  });

  it('writes all-null thresholds when home_handicaps is empty', async () => {
    const bag: StateBag = {
      home_handicaps: [],
      away_handicaps: [500, 500, 500, 500, 500],
      total_games: 25,
    };
    await thresholds.run(bag, {});
    expect(bag.home_to_win).toBeNull();
    expect(bag.home_to_tie).toBeNull();
    expect(bag.home_to_lose).toBeNull();
    expect(bag.away_to_win).toBeNull();
    expect(bag.away_to_tie).toBeNull();
    expect(bag.away_to_lose).toBeNull();
  });

  it('writes all-null thresholds when total_games is 0', async () => {
    const bag: StateBag = {
      home_handicaps: [500, 500, 500, 500, 500],
      away_handicaps: [500, 500, 500, 500, 500],
      total_games: 0,
    };
    await thresholds.run(bag, {});
    expect(bag.home_to_win).toBeNull();
    expect(bag.away_to_win).toBeNull();
  });

  it('writes all-null thresholds when bag entries are missing', async () => {
    const bag: StateBag = {};
    await thresholds.run(bag, {});
    expect(bag.home_to_win).toBeNull();
    expect(bag.home_to_tie).toBeNull();
    expect(bag.home_to_lose).toBeNull();
    expect(bag.away_to_win).toBeNull();
    expect(bag.away_to_tie).toBeNull();
    expect(bag.away_to_lose).toBeNull();
  });

  it('never throws (catches helper exceptions)', () => {
    const bag: StateBag = {
      home_handicaps: [NaN, NaN, NaN, NaN, NaN], // non-finite — helper throws
      away_handicaps: [500, 500, 500, 500, 500],
      total_games: 25,
    };
    expect(() => thresholds.run(bag, {})).not.toThrow();
  });
});
