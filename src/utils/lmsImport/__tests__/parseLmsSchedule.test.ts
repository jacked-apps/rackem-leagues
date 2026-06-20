/**
 * @fileoverview Tests for parseLmsSchedule — raw sheet cells → structured schedule.
 */

import { describe, it, expect } from 'vitest';
import { parseLmsSchedule } from '../parseLmsSchedule';
import type { Sheets } from '@/utils/xlsx/readXlsx';

const good: Sheets = {
  Teams: [
    ['1', 'Bad Shape Crazy'],
    ['2', 'Bye Team'],
    ['3', 'Chalk Cue'],
  ],
  Schedule: [
    ['1', '3 @ 1', '2 @ 1'],
    ['2', '1 @ 3'],
  ],
};

describe('parseLmsSchedule', () => {
  it('parses teams (number → name) and weeks (away/home numbers)', () => {
    const parsed = parseLmsSchedule(good);
    expect(parsed.teams).toEqual([
      { number: 1, name: 'Bad Shape Crazy' },
      { number: 2, name: 'Bye Team' },
      { number: 3, name: 'Chalk Cue' },
    ]);
    expect(parsed.weeks[0]).toEqual({
      weekNumber: 1,
      matches: [
        { awayNumber: 3, homeNumber: 1 },
        { awayNumber: 2, homeNumber: 1 },
      ],
    });
    expect(parsed.weeks[1].matches).toEqual([{ awayNumber: 1, homeNumber: 3 }]);
  });

  it('ignores blank trailing cells/rows', () => {
    const parsed = parseLmsSchedule({
      Teams: [['1', 'A'], ['', ''], ['2', 'B']],
      Schedule: [['1', '2 @ 1', '']],
    });
    expect(parsed.teams.map((t) => t.number)).toEqual([1, 2]);
    expect(parsed.weeks[0].matches).toEqual([{ awayNumber: 2, homeNumber: 1 }]);
  });

  it('throws on a missing required sheet', () => {
    expect(() => parseLmsSchedule({ Teams: [['1', 'A']] })).toThrow(/Schedule/);
    expect(() => parseLmsSchedule({ Schedule: [['1', '2 @ 1']] })).toThrow(/Teams/);
  });

  it('throws on a malformed matchup cell', () => {
    expect(() =>
      parseLmsSchedule({ Teams: [['1', 'A'], ['2', 'B']], Schedule: [['1', '2 vs 1']] }),
    ).toThrow(/not a valid matchup/);
  });

  it('throws when the grid references an unknown team number', () => {
    expect(() =>
      parseLmsSchedule({ Teams: [['1', 'A'], ['2', 'B']], Schedule: [['1', '9 @ 1']] }),
    ).toThrow(/#9/);
  });

  it('throws on a non-numeric week number', () => {
    expect(() =>
      parseLmsSchedule({ Teams: [['1', 'A'], ['2', 'B']], Schedule: [['wk1', '2 @ 1']] }),
    ).toThrow(/week number/);
  });
});
