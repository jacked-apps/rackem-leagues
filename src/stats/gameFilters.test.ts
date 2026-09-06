/**
 * @fileoverview Tests for narrowing a history.
 *
 * The combination cases matter most: Ed described using these together
 * ("fargo + 9-ball"), and a filter that quietly ORed instead of ANDing would
 * still look like it was working.
 */

import { describe, it, expect } from 'vitest';
import {
  applyGameFilter,
  activeFilterCount,
  isUnfiltered,
  NO_FILTER,
} from './gameFilters';
import type { PlayerGameRow } from './playerGameRow';

let seq = 0;

function row(overrides: Partial<PlayerGameRow> = {}): PlayerGameRow {
  seq += 1;
  return {
    gameId: `g${seq}`,
    matchId: 'm1',
    gameNumber: seq,
    playedOn: '2026-05-01',
    seasonId: 'season-1',
    won: true,
    ending: 'plain',
    gameType: 'eight_ball',
    opponentId: 'opp-1',
    opponentName: 'Joe Smith',
    opponentHandicap: 2,
    handicapSystem: 'points',
    venueName: 'Butera Billiards',
    tableNumber: 2,
    myTeamId: 'team-1',
    ...overrides,
  };
}

describe('applyGameFilter - no narrowing', () => {
  it('returns everything when nothing is set', () => {
    const rows = [row(), row(), row()];
    expect(applyGameFilter(rows, NO_FILTER)).toHaveLength(3);
  });

  it('preserves the order it was given', () => {
    const rows = [row({ gameId: 'a' }), row({ gameId: 'b' })];
    expect(applyGameFilter(rows, NO_FILTER).map((r) => r.gameId)).toEqual(['a', 'b']);
  });
});

describe('applyGameFilter - single dimensions', () => {
  it('narrows by game type', () => {
    const rows = [row({ gameType: 'eight_ball' }), row({ gameType: 'nine_ball' })];
    const out = applyGameFilter(rows, { ...NO_FILTER, gameType: 'nine_ball' });
    expect(out).toHaveLength(1);
    expect(out[0].gameType).toBe('nine_ball');
  });

  it('narrows by handicap system', () => {
    const rows = [row({ handicapSystem: 'fargo' }), row({ handicapSystem: 'points' })];
    expect(applyGameFilter(rows, { ...NO_FILTER, handicapSystem: 'fargo' })).toHaveLength(1);
  });

  it('narrows to one opponent (head to head)', () => {
    const rows = [row({ opponentId: 'joe' }), row({ opponentId: 'sue' })];
    expect(applyGameFilter(rows, { ...NO_FILTER, opponentId: 'joe' })).toHaveLength(1);
  });

  it('narrows by venue and by table', () => {
    const rows = [
      row({ venueName: 'Hall A', tableNumber: 1 }),
      row({ venueName: 'Hall A', tableNumber: 2 }),
      row({ venueName: 'Hall B', tableNumber: 2 }),
    ];
    expect(applyGameFilter(rows, { ...NO_FILTER, venueName: 'Hall A' })).toHaveLength(2);
    expect(applyGameFilter(rows, { ...NO_FILTER, tableNumber: 2 })).toHaveLength(2);
  });

  it('narrows by season', () => {
    const rows = [row({ seasonId: 's1' }), row({ seasonId: 's2' })];
    expect(applyGameFilter(rows, { ...NO_FILTER, seasonId: 's2' })).toHaveLength(1);
  });
});

describe('applyGameFilter - the handicap band', () => {
  const rows = [
    row({ opponentHandicap: 0 }),
    row({ opponentHandicap: 2 }),
    row({ opponentHandicap: 50 }),
    row({ opponentHandicap: 75 }),
  ];

  it('matches an exact handicap when both ends are equal', () => {
    const out = applyGameFilter(rows, {
      ...NO_FILTER,
      opponentHandicapMin: 2,
      opponentHandicapMax: 2,
    });
    expect(out.map((r) => r.opponentHandicap)).toEqual([2]);
  });

  it('handles "50 and over" as a lower end only', () => {
    const out = applyGameFilter(rows, { ...NO_FILTER, opponentHandicapMin: 50 });
    expect(out.map((r) => r.opponentHandicap)).toEqual([50, 75]);
  });

  it('handles "2 and under" as an upper end only', () => {
    const out = applyGameFilter(rows, { ...NO_FILTER, opponentHandicapMax: 2 });
    expect(out.map((r) => r.opponentHandicap)).toEqual([0, 2]);
  });

  it('includes both ends of a band', () => {
    const out = applyGameFilter(rows, {
      ...NO_FILTER,
      opponentHandicapMin: 2,
      opponentHandicapMax: 50,
    });
    expect(out.map((r) => r.opponentHandicap)).toEqual([2, 50]);
  });

  it('keeps a zero handicap, which is a real value', () => {
    const out = applyGameFilter(rows, {
      ...NO_FILTER,
      opponentHandicapMin: 0,
      opponentHandicapMax: 0,
    });
    expect(out).toHaveLength(1);
  });

  it('excludes games with no recorded handicap from a handicap question', () => {
    // Including them would inflate a record "against 2s" with games whose
    // opponent might have been anything at all.
    const withUnknown = [...rows, row({ opponentHandicap: null })];
    const out = applyGameFilter(withUnknown, { ...NO_FILTER, opponentHandicapMin: 0 });
    expect(out.every((r) => r.opponentHandicap !== null)).toBe(true);
  });

  it('keeps games with no handicap when no band is set', () => {
    const withUnknown = [row({ opponentHandicap: null })];
    expect(applyGameFilter(withUnknown, NO_FILTER)).toHaveLength(1);
  });
});

describe('applyGameFilter - filters combine with AND', () => {
  const rows = [
    row({ gameType: 'nine_ball', handicapSystem: 'fargo' }),
    row({ gameType: 'nine_ball', handicapSystem: 'points' }),
    row({ gameType: 'eight_ball', handicapSystem: 'fargo' }),
  ];

  it('fargo AND 9-ball means both, not either', () => {
    const out = applyGameFilter(rows, {
      ...NO_FILTER,
      gameType: 'nine_ball',
      handicapSystem: 'fargo',
    });
    expect(out).toHaveLength(1);
  });

  it('returns nothing when the combination has no games', () => {
    const out = applyGameFilter(rows, {
      ...NO_FILTER,
      gameType: 'ten_ball',
      handicapSystem: 'fargo',
    });
    expect(out).toEqual([]);
  });
});

describe('filter state helpers', () => {
  it('recognises an untouched filter', () => {
    expect(isUnfiltered(NO_FILTER)).toBe(true);
    expect(activeFilterCount(NO_FILTER)).toBe(0);
  });

  it('counts each active control once', () => {
    const filter = { ...NO_FILTER, gameType: 'nine_ball', venueName: 'Hall A' };
    expect(isUnfiltered(filter)).toBe(false);
    expect(activeFilterCount(filter)).toBe(2);
  });

  it('counts a handicap band as one filter, not two', () => {
    const filter = { ...NO_FILTER, opponentHandicapMin: 2, opponentHandicapMax: 5 };
    expect(activeFilterCount(filter)).toBe(1);
  });

  it('counts a one-ended handicap band', () => {
    expect(activeFilterCount({ ...NO_FILTER, opponentHandicapMin: 50 })).toBe(1);
  });
});
