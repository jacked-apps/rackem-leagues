/**
 * @fileoverview invalidateSeasonSchedule marks everything a schedule change
 * makes stale (this season's schedule, match lists, team lists incl. the BYE,
 * this season's standings) and leaves another season's schedule and standings
 * cached. Bug it guards (Ed, 2026-11-21): Matchups showed the OLD schedule
 * after a rebuild, because nothing told the 5-minute cache.
 */

import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { invalidateSeasonSchedule } from './useInvalidateSeasonSchedule';

describe('invalidateSeasonSchedule', () => {
  it('marks this season stale and leaves other seasons alone', async () => {
    const qc = new QueryClient();
    const keys = {
      schedule: queryKeys.schedules.bySeason('s1'),
      weeks: [...queryKeys.schedules.bySeason('s1'), 'weeks'],
      seasonMatches: [...queryKeys.matches.all, 'season', 's1'],
      teams: queryKeys.teams.bySeason('s1'),
      standings: queryKeys.stats.standings('s1'),
      otherSchedule: queryKeys.schedules.bySeason('s2'),
      otherStandings: queryKeys.stats.standings('s2'),
    };
    for (const k of Object.values(keys)) qc.setQueryData(k, ['cached']);

    await invalidateSeasonSchedule(qc, 's1');

    const stale = (k: readonly unknown[]) => qc.getQueryState(k)?.isInvalidated;
    expect(stale(keys.schedule)).toBe(true);
    expect(stale(keys.weeks)).toBe(true);
    expect(stale(keys.seasonMatches)).toBe(true);
    expect(stale(keys.teams)).toBe(true);
    expect(stale(keys.standings)).toBe(true);
    expect(stale(keys.otherSchedule)).toBe(false);
    expect(stale(keys.otherStandings)).toBe(false);
  });
});
