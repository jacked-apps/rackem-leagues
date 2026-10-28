/**
 * @fileoverview Tests for getTiebreakerShape — the format → numbers mapping
 * frozen onto every tiebreak record.
 */

import { describe, it, expect } from 'vitest';
import { getTiebreakerShape } from '../tiebreakerShape';

describe('getTiebreakerShape', () => {
  it('best_of_3_short_race is first to 2 of 3, three players a side', () => {
    expect(getTiebreakerShape('best_of_3_short_race')).toEqual({
      gamesNeeded: 2,
      gameCount: 3,
      playersPerSide: 3,
    });
  });

  it('single_short_race is one game, one player a side', () => {
    expect(getTiebreakerShape('single_short_race')).toEqual({
      gamesNeeded: 1,
      gameCount: 1,
      playersPerSide: 1,
    });
  });

  it('accept_tie still gets best-of-3 — it was an accidental default, never a choice', () => {
    expect(getTiebreakerShape('accept_tie')).toEqual(getTiebreakerShape('best_of_3_short_race'));
  });

  it('manual makes no record', () => {
    expect(getTiebreakerShape('manual')).toBeNull();
  });

  it.each([undefined, null, 'something_new'])('%s falls back to best-of-3', (format) => {
    expect(getTiebreakerShape(format)).toEqual(getTiebreakerShape('best_of_3_short_race'));
  });
});
