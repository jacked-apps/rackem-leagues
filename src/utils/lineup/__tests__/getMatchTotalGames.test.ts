/**
 * @fileoverview Tests for getMatchTotalGames (Phase 5 Unit 5.2 helper)
 *
 * Locks the lineup-size × round-robin-multiplier formula across the
 * combinations the modular system supports, plus the graceful fallback
 * for unknown game-generation values.
 */

import { describe, it, expect } from 'vitest';
import { getMatchTotalGames } from '../getMatchTotalGames';

describe('getMatchTotalGames', () => {
  it('3v3 double-round-robin = 18 (preserves BCA 3v3 today)', () => {
    expect(getMatchTotalGames({ lineupSize: 3, gameGeneration: 'double_round_robin' })).toBe(18);
  });

  it('5v5 single-round-robin = 25 (preserves BCA 5v5 / Fargo 5v5 today)', () => {
    expect(getMatchTotalGames({ lineupSize: 5, gameGeneration: 'single_round_robin' })).toBe(25);
  });

  it('4v4 single-round-robin = 16', () => {
    expect(getMatchTotalGames({ lineupSize: 4, gameGeneration: 'single_round_robin' })).toBe(16);
  });

  it('4v4 double-round-robin = 32', () => {
    expect(getMatchTotalGames({ lineupSize: 4, gameGeneration: 'double_round_robin' })).toBe(32);
  });

  it('6v6 single-round-robin = 36', () => {
    expect(getMatchTotalGames({ lineupSize: 6, gameGeneration: 'single_round_robin' })).toBe(36);
  });

  it('falls back to single-round-robin multiplier for unknown gameGeneration', () => {
    expect(getMatchTotalGames({ lineupSize: 5, gameGeneration: 'experimental' })).toBe(25);
  });

  it('lineup_size of 1 (individual leagues, future scope) = 1 game per match', () => {
    expect(getMatchTotalGames({ lineupSize: 1, gameGeneration: 'single_round_robin' })).toBe(1);
  });
});
