/**
 * @fileoverview Unit tests for tiebreaker game-number arithmetic.
 *
 * Locks the helper that abstracts the previously-hardcoded `[19, 20, 21]`
 * tiebreaker numbers from BCA 3v3 to any match-total-games.
 *
 * This file is now the sole home for the "games 19-21 are tiebreakers
 * for an 18-game 3v3 match" assertion — see the first test below.
 * (Previously cross-referenced an `isTiebreakerGame` predicate in
 * `src/utils/__tests__/gameOrder.characterization.test.ts`; that helper
 * was retired alongside the Pairings Generator extraction.)
 */

import { describe, it, expect } from 'vitest';
import {
  tiebreakerGameNumbers,
  tiebreakerGameToPosition,
  tiebreakerGameSpecs,
} from '../gameNumbers';

describe('tiebreakerGameNumbers', () => {
  it('BCA 3v3 (18 regular games) → [19, 20, 21]', () => {
    expect(tiebreakerGameNumbers(18)).toEqual([19, 20, 21]);
  });

  it('4v4 single round-robin (16 games) → [17, 18, 19]', () => {
    expect(tiebreakerGameNumbers(16)).toEqual([17, 18, 19]);
  });

  it('4v4 double round-robin (32 games) → [33, 34, 35]', () => {
    expect(tiebreakerGameNumbers(32)).toEqual([33, 34, 35]);
  });

  it('5v5 single round-robin (25 games — though no ties possible at odd total) → [26, 27, 28]', () => {
    // Lineup geometry doesn't restrict tiebreaker triggering — that's
    // tiebreaker_trigger preference's job. The arithmetic just works.
    expect(tiebreakerGameNumbers(25)).toEqual([26, 27, 28]);
  });

  it('5v5 double round-robin (50 games — even, ties possible) → [51, 52, 53]', () => {
    expect(tiebreakerGameNumbers(50)).toEqual([51, 52, 53]);
  });

  it('6v6 SRR (36 games) → [37, 38, 39]', () => {
    expect(tiebreakerGameNumbers(36)).toEqual([37, 38, 39]);
  });

  it('count=0 (tiebreaker_format=accept_tie) → empty array', () => {
    expect(tiebreakerGameNumbers(18, 0)).toEqual([]);
  });

  it('count=1 (tiebreaker_format=single_short_race) → single game', () => {
    expect(tiebreakerGameNumbers(18, 1)).toEqual([19]);
  });

  it('count=5 → 5 sequential numbers', () => {
    expect(tiebreakerGameNumbers(18, 5)).toEqual([19, 20, 21, 22, 23]);
  });

  it('throws on negative matchTotalGames (defensive)', () => {
    expect(() => tiebreakerGameNumbers(-1)).toThrow();
  });
});

describe('tiebreakerGameToPosition', () => {
  it('game 19 in 18-game match → position 0', () => {
    expect(tiebreakerGameToPosition(18, 19)).toBe(0);
  });

  it('game 20 in 18-game match → position 1', () => {
    expect(tiebreakerGameToPosition(18, 20)).toBe(1);
  });

  it('game 21 in 18-game match → position 2', () => {
    expect(tiebreakerGameToPosition(18, 21)).toBe(2);
  });

  it('game 17 in 16-game match → position 0', () => {
    expect(tiebreakerGameToPosition(16, 17)).toBe(0);
  });

  it('game 51 in 50-game match → position 0', () => {
    expect(tiebreakerGameToPosition(50, 51)).toBe(0);
  });
});

describe('tiebreakerGameSpecs', () => {
  it('BCA 3v3 default 3-game tiebreaker → matches the legacy hardcoded inserts (19/20/21 with breaks/racks/breaks)', () => {
    expect(tiebreakerGameSpecs(18)).toEqual([
      { game_number: 19, home_action: 'breaks', away_action: 'racks' },
      { game_number: 20, home_action: 'racks', away_action: 'breaks' },
      { game_number: 21, home_action: 'breaks', away_action: 'racks' },
    ]);
  });

  it('count=1 → single game with home breaking', () => {
    expect(tiebreakerGameSpecs(18, 1)).toEqual([
      { game_number: 19, home_action: 'breaks', away_action: 'racks' },
    ]);
  });

  it('count=0 → empty array', () => {
    expect(tiebreakerGameSpecs(18, 0)).toEqual([]);
  });

  it('arbitrary lineup geometry: 4v4 SRR (16 games), 3 tiebreakers', () => {
    expect(tiebreakerGameSpecs(16)).toEqual([
      { game_number: 17, home_action: 'breaks', away_action: 'racks' },
      { game_number: 18, home_action: 'racks', away_action: 'breaks' },
      { game_number: 19, home_action: 'breaks', away_action: 'racks' },
    ]);
  });

  it('home/away actions are always opposites', () => {
    const specs = tiebreakerGameSpecs(18, 5);
    for (const s of specs) {
      if (s.home_action === 'breaks') {
        expect(s.away_action).toBe('racks');
      } else {
        expect(s.away_action).toBe('breaks');
      }
    }
  });
});
