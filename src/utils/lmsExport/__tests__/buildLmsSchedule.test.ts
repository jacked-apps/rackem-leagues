/**
 * @fileoverview Unit tests for buildLmsSchedule — the pure LMS-export resolver.
 */

import { describe, it, expect } from 'vitest';
import { buildLmsSchedule } from '../buildLmsSchedule';
import type { LmsSourceTeam, LmsSourceMatch, LmsSourceWeek } from '../buildLmsSchedule';

const team = (id: string, name: string, status: 'active' | 'bye' = 'active'): LmsSourceTeam => ({
  id,
  team_name: name,
  status,
});

function match(num: number, home: LmsSourceTeam | null, away: LmsSourceTeam | null): LmsSourceMatch {
  return { match_number: num, home_team: home, away_team: away };
}

function week(
  _id: string,
  name: string,
  type: string,
  date: string,
  matches: LmsSourceMatch[],
): LmsSourceWeek {
  return { week: { week_name: name, week_type: type, scheduled_date: date }, matches };
}

// Four teams; "Bye" is the system bye (normalized to "Bye Team").
const zed = team('z', 'Zed Cues');
const ace = team('a', 'Ace Crew');
const mid = team('m', 'Mid Pack');
const bye = team('b', 'BYE', 'bye');

describe('buildLmsSchedule', () => {
  it('numbers teams alphabetically (case-insensitive) and normalizes the bye to "Bye Team"', () => {
    const schedule = [
      week('w1', 'Week 1', 'regular', '2026-01-05', [match(1, ace, zed), match(2, mid, bye)]),
    ];
    const { teams } = buildLmsSchedule(schedule);
    // Ace Crew, BYE→"Bye Team", Mid Pack, Zed Cues  →  1,2,3,4
    expect(teams.map((t) => `${t.number}:${t.name}`)).toEqual([
      '1:Ace Crew',
      '2:Bye Team',
      '3:Mid Pack',
      '4:Zed Cues',
    ]);
    expect(teams.find((t) => t.isBye)?.number).toBe(2);
  });

  it('emits cells as "away @ home" by number, in match order', () => {
    const schedule = [
      week('w1', 'Week 1', 'regular', '2026-01-05', [match(1, ace, zed), match(2, mid, bye)]),
    ];
    const { weeks } = buildLmsSchedule(schedule);
    // ace=1(home) zed=4(away) → "4 @ 1"; mid=3(home) bye=2(away) → "2 @ 3"
    expect(weeks[0].cells).toEqual(['4 @ 1', '2 @ 3']);
  });

  it('numbers play weeks 1..N, skipping blackout/break and empty weeks', () => {
    const schedule = [
      week('w1', 'Week 1', 'regular', '2026-01-05', [match(1, ace, zed)]),
      week('b1', 'Holiday', 'blackout', '2026-01-12', []),
      week('w2', 'Week 2', 'regular', '2026-01-19', [match(1, zed, ace)]),
    ];
    const { weeks } = buildLmsSchedule(schedule);
    expect(weeks.map((w) => w.weekNumber)).toEqual([1, 2]);
    expect(weeks.map((w) => w.weekName)).toEqual(['Week 1', 'Week 2']);
  });

  it('skips matches with a NULL team (legacy bye / playoff TBD)', () => {
    const schedule = [
      week('w1', 'Week 1', 'regular', '2026-01-05', [match(1, ace, zed), match(2, mid, null)]),
    ];
    const { weeks, teams } = buildLmsSchedule(schedule);
    expect(weeks[0].cells).toEqual(['2 @ 1']); // only ace vs zed; mid (null opp) dropped
    expect(teams.map((t) => t.name)).toEqual(['Ace Crew', 'Zed Cues']); // mid never appears
  });

  it('builds verification stats: home/away counts + opponent frequency', () => {
    const schedule = [
      week('w1', 'Week 1', 'regular', '2026-01-05', [match(1, ace, zed)]),
      week('w2', 'Week 2', 'regular', '2026-01-12', [match(1, ace, zed)]),
      week('w3', 'Week 3', 'regular', '2026-01-19', [match(1, zed, ace)]),
    ];
    const { stats } = buildLmsSchedule(schedule);
    const aceStat = stats.find((s) => s.name === 'Ace Crew')!;
    expect(aceStat.home).toBe(2); // home in w1, w2
    expect(aceStat.away).toBe(1); // away in w3
    expect(aceStat.opponents).toEqual([{ name: 'Zed Cues', count: 3 }]);
  });
});
