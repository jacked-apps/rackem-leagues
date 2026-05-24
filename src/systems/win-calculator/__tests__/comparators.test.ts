/**
 * @fileoverview Unit tests for the Win Calculator comparators (`most`, `metGoal`).
 *
 * Pure functions, so these are plain input→output assertions: happy paths, the
 * equal/neither "no decision" edges, the null-target case, and the both-met
 * anomaly (no winner + a surfaced flag).
 */
import { describe, it, expect } from 'vitest';
import { most, metGoal } from '../comparators';

describe('most', () => {
  it('names the higher total the winner', () => {
    expect(most(12, 6)).toEqual({ winner: 'home' });
    expect(most(6, 12)).toEqual({ winner: 'away' });
  });

  it('returns no decision on equal totals', () => {
    expect(most(9, 9)).toEqual({ winner: null });
    expect(most(0, 0)).toEqual({ winner: null });
  });
});

describe('metGoal', () => {
  it('names the side that reached its own target', () => {
    // home 10 >= 10 (met); away 7 < 12 (not met)
    expect(metGoal(10, 10, 7, 12)).toEqual({ winner: 'home' });
    // home 7 < 10 (not met); away 8 >= 8 (met)
    expect(metGoal(7, 10, 8, 8)).toEqual({ winner: 'away' });
  });

  it('returns no decision when neither side reached its target', () => {
    expect(metGoal(7, 10, 6, 8)).toEqual({ winner: null });
  });

  it('surfaces an anomaly (and no winner) when BOTH sides reached their target', () => {
    const r = metGoal(10, 10, 8, 8);
    // Impossible with correct targets: the comparator names no winner and flags it.
    if (r.winner === null) {
      expect(r.anomaly).toBeTruthy();
    } else {
      throw new Error(`expected no winner, got ${r.winner}`);
    }
  });

  it('treats a null target as "cannot meet a goal" (no decision from that side)', () => {
    // home target null → home cannot meet; away 9 >= 8 (met) → away wins
    expect(metGoal(10, null, 9, 8)).toEqual({ winner: 'away' });
    // home target null; away 6 < 8 (not met) → no decision
    expect(metGoal(10, null, 6, 8)).toEqual({ winner: null });
  });
});
