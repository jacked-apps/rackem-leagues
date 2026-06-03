/**
 * @fileoverview Tests for seedLineupPlayers.
 */

import { describe, it, expect } from 'vitest';
import { seedLineupPlayers } from '../seedLineupPlayers';
import type { StateBag } from '@/systems/chain-runtime/types';

describe('seedLineupPlayers', () => {
  it('writes per-slot player IDs and lineup row IDs for a 3v3 lineup', async () => {
    const bag: StateBag = {};
    await seedLineupPlayers.run(bag, {
      homeLineup: {
        id: 'lineup-home',
        player1_id: 'p1',
        player2_id: 'p2',
        player3_id: 'p3',
      },
      awayLineup: {
        id: 'lineup-away',
        player1_id: 'a1',
        player2_id: 'a2',
        player3_id: 'a3',
      },
    });
    expect(bag.home_player_ids).toEqual(['p1', 'p2', 'p3', null, null]);
    expect(bag.away_player_ids).toEqual(['a1', 'a2', 'a3', null, null]);
    expect(bag.home_lineup_id).toBe('lineup-home');
    expect(bag.away_lineup_id).toBe('lineup-away');
  });

  it('writes all five slots for a 5v5 lineup', async () => {
    const bag: StateBag = {};
    await seedLineupPlayers.run(bag, {
      homeLineup: {
        id: 'h-id',
        player1_id: 'h1',
        player2_id: 'h2',
        player3_id: 'h3',
        player4_id: 'h4',
        player5_id: 'h5',
      },
      awayLineup: {
        id: 'a-id',
        player1_id: 'a1',
        player2_id: 'a2',
        player3_id: 'a3',
        player4_id: 'a4',
        player5_id: 'a5',
      },
    });
    expect(bag.home_player_ids).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);
    expect(bag.away_player_ids).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
  });

  it('preserves null slot positions (does not filter)', async () => {
    const bag: StateBag = {};
    await seedLineupPlayers.run(bag, {
      homeLineup: {
        player1_id: 'p1',
        player2_id: null,
        player3_id: 'p3',
      },
    });
    expect(bag.home_player_ids).toEqual(['p1', null, 'p3', null, null]);
  });

  it('writes all-null arrays when lineups are missing', async () => {
    const bag: StateBag = {};
    await seedLineupPlayers.run(bag, {});
    expect(bag.home_player_ids).toEqual([null, null, null, null, null]);
    expect(bag.away_player_ids).toEqual([null, null, null, null, null]);
    expect(bag.home_lineup_id).toBeNull();
    expect(bag.away_lineup_id).toBeNull();
  });

  it('never throws on null lineups', () => {
    const bag: StateBag = {};
    expect(() =>
      seedLineupPlayers.run(bag, { homeLineup: null, awayLineup: null }),
    ).not.toThrow();
  });
});
