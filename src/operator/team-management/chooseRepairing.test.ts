/**
 * @fileoverview chooseRepairing: Ed's hybrid (2026-11-19). Pair the two leftover
 * teams (X lost its opponent, Y had the bye) unless pulling in one more match
 * that night gives a fairer end-of-season count: lowest worst pair, then the
 * most even spread, then fewest teams changed.
 */

import { describe, it, expect } from 'vitest';
import { chooseRepairing, pairKey, type PairCounts } from './chooseRepairing';

const counts = (entries: [string, string, number][]): PairCounts =>
  new Map(entries.map(([a, b, n]) => [pairKey(a, b), n]));
const AB = { id: 'm-ab', homeTeamId: 'A', awayTeamId: 'B' };

describe('chooseRepairing', () => {
  it('plain swap when it keeps the season counts more even than pulling a match in', () => {
    const c = counts([['X', 'Y', 1], ['A', 'B', 1], ['X', 'A', 1], ['Y', 'B', 1], ['X', 'B', 1], ['Y', 'A', 1]]);
    expect(chooseRepairing('X', 'Y', [AB], c)).toEqual({ pairs: [['X', 'Y']] });
  });

  it('pulls in another match when X and Y have already met far more than anyone else', () => {
    // X–Y already 3 times; X–A / Y–B never. Swapping would make X–Y 4.
    const c = counts([['X', 'Y', 3], ['A', 'B', 1]]);
    expect(chooseRepairing('X', 'Y', [AB], c)).toEqual({ pairs: [['X', 'A'], ['Y', 'B']], pulled: AB });
  });

  it('picks the cross pairing (X–B, Y–A) when that one is fairer', () => {
    const c = counts([['X', 'Y', 3], ['A', 'B', 1], ['X', 'A', 2], ['Y', 'B', 2]]);
    expect(chooseRepairing('X', 'Y', [AB], c)).toEqual({ pairs: [['X', 'B'], ['Y', 'A']], pulled: AB });
  });

  it('with no other match to pull in, the plain swap is the only option', () => {
    expect(chooseRepairing('X', 'Y', [], counts([['X', 'Y', 5]]))).toEqual({ pairs: [['X', 'Y']] });
  });
});
