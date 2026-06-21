/**
 * @fileoverview Golden test for the schedule edit-lock conversion (Phase A, A3).
 *
 * The operator schedule table used to decide whether a week is "locked"
 * (already played, shows 🔒) by PARSING "Week N" out of week_name and comparing
 * it to the highest past regular week's parsed number. That parsing is exactly
 * the drift/collision bug this refactor removes (e.g. a duplicate "Week 14").
 *
 * `isPlayWeekLocked` replaces it with a position/number-free rule: a regular week
 * is locked iff its date is before the cutoff. These tests prove:
 *   1. on a correctly-numbered season the locked SET is byte-identical to the old
 *      parse-based logic (no behavior change), and
 *   2. on a mis-numbered season the new rule is CORRECT where the old one was
 *      wrong (it no longer locks a future duplicate-numbered week).
 */

import { describe, it, expect } from 'vitest';
import { isPlayWeekLocked } from '@/utils/scheduleDisplayUtils';

type Row = { weekName: string; date: string; type: 'regular' | 'playoffs' | 'week-off' };

/**
 * The OLD lock logic, inlined verbatim as the golden reference:
 * currentPlayWeek = max parsed "Week N" among past regular weeks; a row locks if
 * its own parsed number is ≤ currentPlayWeek.
 */
function oldLockedSet(schedule: Row[], today: string): boolean[] {
  const parse = (name: string): number | null => {
    const m = name.match(/^Week (\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  };
  let currentPlayWeek = 0;
  for (const w of schedule) {
    if (w.type === 'regular' && w.date < today) {
      const n = parse(w.weekName);
      if (n !== null) currentPlayWeek = Math.max(currentPlayWeek, n);
    }
  }
  return schedule.map((w) => {
    const n = parse(w.weekName);
    return n !== null && n <= currentPlayWeek;
  });
}

const newLockedSet = (schedule: Row[], today: string): boolean[] =>
  schedule.map((w) => isPlayWeekLocked(w, today));

describe('isPlayWeekLocked — golden vs old parse-based lock', () => {
  it('matches the old locked set exactly on a correctly-numbered season', () => {
    const schedule: Row[] = [
      { weekName: 'Week 1', date: '2026-01-06', type: 'regular' },
      { weekName: 'Holiday', date: '2026-01-13', type: 'week-off' },
      { weekName: 'Week 2', date: '2026-01-20', type: 'regular' },
      { weekName: 'Week 3', date: '2026-01-27', type: 'regular' },
      { weekName: 'Week 4', date: '2026-02-03', type: 'regular' },
      { weekName: 'Playoffs', date: '2026-02-10', type: 'playoffs' },
    ];
    const today = '2026-01-28'; // Weeks 1-3 are in the past

    expect(newLockedSet(schedule, today)).toEqual(oldLockedSet(schedule, today));
    // Sanity: the past regular weeks lock; the blackout/playoffs/future do not.
    expect(newLockedSet(schedule, today)).toEqual([true, false, true, true, false, false]);
  });

  it('fixes the mis-numbered season: a FUTURE duplicate "Week 14" is not locked', () => {
    // The prod shape: a duplicate "Week 14" — one past, one future.
    const schedule: Row[] = [
      { weekName: 'Week 13', date: '2026-09-13', type: 'regular' },
      { weekName: 'Week 14', date: '2026-09-20', type: 'regular' }, // past
      { weekName: 'Week 14', date: '2026-09-27', type: 'regular' }, // FUTURE
      { weekName: 'Week 15', date: '2026-10-04', type: 'regular' },
    ];
    const today = '2026-09-21'; // 9/13 + first 9/20 are past; the rest future

    const oldSet = oldLockedSet(schedule, today);
    const newSet = newLockedSet(schedule, today);

    // The new rule is correct: only the two genuinely-past weeks lock.
    expect(newSet).toEqual([true, true, false, false]);
    // The old rule was WRONG here — it locked the FUTURE second "Week 14"
    // (parsed 14 ≤ currentPlayWeek 14). This asserts the bug is gone.
    expect(oldSet[2]).toBe(true); // old: future Week 14 wrongly locked
    expect(newSet[2]).toBe(false); // new: correctly editable
    expect(newSet).not.toEqual(oldSet);
  });

  it('locks nothing when the cutoff makes every regular week future', () => {
    const schedule: Row[] = [
      { weekName: 'Week 1', date: '2026-03-03', type: 'regular' },
      { weekName: 'Week 2', date: '2026-03-10', type: 'regular' },
    ];
    expect(newLockedSet(schedule, '2026-01-01')).toEqual([false, false]);
  });
});
