/**
 * @fileoverview Tests for the pure blackout re-flow logic (scheduleReflow.ts).
 *
 * Covers the locked model: adding/removing a blackout re-dates PLAY weeks (regular +
 * playoffs) around fixed SKIP nights (blackout + season_end_break), preserves the
 * play-week count, never references matches, and extends/contracts the season tail.
 */
import { describe, it, expect } from 'vitest';
import {
  computeBlackoutReflow,
  type ReflowWeek,
  type ReflowPlan,
  type ReflowWeekType,
} from './scheduleReflow';

// --- Helpers ---------------------------------------------------------------

let idSeq = 0;
const wk = (
  date: string,
  weekType: ReflowWeekType,
  weekName = '',
  weekCompleted = false,
): ReflowWeek => ({
  id: `w${++idSeq}-${weekType}-${date}`,
  date,
  weekType,
  weekName: weekName || weekType,
  weekCompleted,
});

const isPlay = (w: ReflowWeek) =>
  w.weekType === 'regular' || w.weekType === 'playoffs';

/**
 * Simulate applying a plan to the input weeks and return the resulting rows.
 * Used to assert post-condition invariants (unique dates, preserved play count).
 */
function applyPlan(weeks: ReflowWeek[], plan: ReflowPlan): ReflowWeek[] {
  const byId = new Map(weeks.map((w) => [w.id, { ...w }]));
  for (const id of plan.deleteWeekIds) byId.delete(id);
  for (const u of plan.dateUpdates) {
    const row = byId.get(u.id);
    if (row) row.date = u.date;
  }
  const result = [...byId.values()];
  for (const ins of plan.insertSkips) {
    result.push(wk(ins.date, ins.weekType, ins.weekName));
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/** A 3-regular + season-end break + 1-playoff season on Wednesdays. */
const seasonWithBreakAndPlayoff = (): ReflowWeek[] => [
  wk('2026-07-01', 'regular', 'Week 1'),
  wk('2026-07-08', 'regular', 'Week 2'),
  wk('2026-07-15', 'regular', 'Week 3'),
  wk('2026-07-22', 'season_end_break', 'Season End Break'),
  wk('2026-07-29', 'playoffs', 'Playoffs'),
];

// --- Add blackout ----------------------------------------------------------

describe('computeBlackoutReflow — add', () => {
  it('happy path: blacking out a mid-season night slides later play weeks +1 week', () => {
    const weeks = seasonWithBreakAndPlayoff();
    const plan = computeBlackoutReflow(weeks, {
      kind: 'add',
      date: '2026-07-08',
      reason: 'Holiday',
      skipType: 'blackout',
    });

    // New blackout inserted on the targeted night.
    expect(plan.insertSkips).toEqual([
      { date: '2026-07-08', weekType: 'blackout', weekName: 'Holiday' },
    ]);
    expect(plan.deleteWeekIds).toEqual([]);

    // Week 2 -> 7/15, Week 3 -> 7/29 (skips the fixed 7/22 break), Playoff -> 8/05.
    const updates = Object.fromEntries(
      plan.dateUpdates.map((u) => [weeks.find((w) => w.id === u.id)!.weekName, u.date]),
    );
    expect(updates).toEqual({
      'Week 2': '2026-07-15',
      'Week 3': '2026-07-29',
      Playoffs: '2026-08-05',
    });
    // Season tail extended one week.
    expect(plan.newSeasonEndDate).toBe('2026-08-05');
  });

  it('blacking out the first play night shifts every play week', () => {
    const weeks = seasonWithBreakAndPlayoff();
    const plan = computeBlackoutReflow(weeks, {
      kind: 'add',
      date: '2026-07-01',
      reason: 'New Year',
      skipType: 'blackout',
    });
    // All four play weeks move.
    expect(plan.dateUpdates).toHaveLength(4);
    expect(plan.newSeasonEndDate).toBe('2026-08-05');
  });

  it('treats playoffs as a play week (it shifts with the season)', () => {
    const weeks = seasonWithBreakAndPlayoff();
    const plan = computeBlackoutReflow(weeks, {
      kind: 'add',
      date: '2026-07-08',
      reason: 'Holiday',
      skipType: 'blackout',
    });
    const playoffRow = weeks.find((w) => w.weekType === 'playoffs')!;
    const playoffUpdate = plan.dateUpdates.find((u) => u.id === playoffRow.id);
    expect(playoffUpdate?.date).toBe('2026-08-05');
  });

  it('flows play weeks around an existing fixed break date instead of onto it', () => {
    const weeks = seasonWithBreakAndPlayoff();
    const plan = computeBlackoutReflow(weeks, {
      kind: 'add',
      date: '2026-07-08',
      reason: 'Holiday',
      skipType: 'blackout',
    });
    // No play week is dated onto the 7/22 break; Week 3 lands on 7/29.
    const wk3 = weeks.find((w) => w.weekName === 'Week 3')!;
    expect(plan.dateUpdates.find((u) => u.id === wk3.id)?.date).toBe('2026-07-29');
    expect(plan.dateUpdates.some((u) => u.date === '2026-07-22')).toBe(false);
  });

  it('regular-only season: append-at-end behavior with no break/playoff', () => {
    const weeks = [
      wk('2026-07-01', 'regular', 'Week 1'),
      wk('2026-07-08', 'regular', 'Week 2'),
      wk('2026-07-15', 'regular', 'Week 3'),
    ];
    const plan = computeBlackoutReflow(weeks, {
      kind: 'add',
      date: '2026-07-08',
      reason: 'Holiday',
      skipType: 'blackout',
    });
    const updates = Object.fromEntries(
      plan.dateUpdates.map((u) => [weeks.find((w) => w.id === u.id)!.weekName, u.date]),
    );
    expect(updates).toEqual({ 'Week 2': '2026-07-15', 'Week 3': '2026-07-22' });
    expect(plan.newSeasonEndDate).toBe('2026-07-22');
  });

  it('orders add date-updates by DESCENDING new date (collision-safe later-shift)', () => {
    const weeks = seasonWithBreakAndPlayoff();
    const plan = computeBlackoutReflow(weeks, {
      kind: 'add',
      date: '2026-07-08',
      reason: 'Holiday',
      skipType: 'blackout',
    });
    const dates = plan.dateUpdates.map((u) => u.date);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });
});

// --- Remove blackout -------------------------------------------------------

describe('computeBlackoutReflow — remove', () => {
  const seasonWithBlackout = (): ReflowWeek[] => [
    wk('2026-07-01', 'regular', 'Week 1'),
    wk('2026-07-08', 'blackout', 'Holiday'),
    wk('2026-07-15', 'regular', 'Week 2'),
    wk('2026-07-22', 'regular', 'Week 3'),
    wk('2026-07-29', 'playoffs', 'Playoffs'),
  ];

  it('happy path: removing a blackout pulls later play weeks in by one week', () => {
    const weeks = seasonWithBlackout();
    const blackout = weeks.find((w) => w.weekType === 'blackout')!;
    const plan = computeBlackoutReflow(weeks, { kind: 'remove', date: '2026-07-08' });

    expect(plan.deleteWeekIds).toEqual([blackout.id]);
    expect(plan.insertSkips).toEqual([]);

    const updates = Object.fromEntries(
      plan.dateUpdates.map((u) => [weeks.find((w) => w.id === u.id)!.weekName, u.date]),
    );
    expect(updates).toEqual({
      'Week 2': '2026-07-08',
      'Week 3': '2026-07-15',
      Playoffs: '2026-07-22',
    });
    expect(plan.newSeasonEndDate).toBe('2026-07-22');
  });

  it('orders remove date-updates by ASCENDING new date (collision-safe earlier-shift)', () => {
    const weeks = seasonWithBlackout();
    const plan = computeBlackoutReflow(weeks, { kind: 'remove', date: '2026-07-08' });
    const dates = plan.dateUpdates.map((u) => u.date);
    expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)));
  });
});

// --- Error paths -----------------------------------------------------------

describe('computeBlackoutReflow — guards', () => {
  it('throws on an empty schedule', () => {
    expect(() =>
      computeBlackoutReflow([], { kind: 'add', date: '2026-07-01', reason: 'x', skipType: 'blackout' }),
    ).toThrow(/empty schedule/i);
  });

  it('add throws when the target date is not a play week', () => {
    const weeks = seasonWithBreakAndPlayoff();
    // 7/22 is the season-end break (a skip), not a play week.
    expect(() =>
      computeBlackoutReflow(weeks, { kind: 'add', date: '2026-07-22', reason: 'x', skipType: 'blackout' }),
    ).toThrow(/not a play week/i);
  });

  it('remove throws when the target date is a play week (not a skip)', () => {
    const weeks = seasonWithBreakAndPlayoff();
    // 7/01 is a regular play week, not a skip.
    expect(() =>
      computeBlackoutReflow(weeks, { kind: 'remove', date: '2026-07-01' }),
    ).toThrow(/no skip week/i);
  });

  it('remove deletes a season_end_break too (it is a skip, just a different label)', () => {
    const weeks = seasonWithBreakAndPlayoff();
    const breakRow = weeks.find((w) => w.weekType === 'season_end_break')!;
    const plan = computeBlackoutReflow(weeks, { kind: 'remove', date: '2026-07-22' });
    // The break row is deleted and the playoff pulls in from 7/29 -> 7/22.
    expect(plan.deleteWeekIds).toEqual([breakRow.id]);
    const playoff = weeks.find((w) => w.weekType === 'playoffs')!;
    expect(plan.dateUpdates.find((u) => u.id === playoff.id)?.date).toBe('2026-07-22');
    expect(plan.newSeasonEndDate).toBe('2026-07-22');
  });
});

// --- Invariants ------------------------------------------------------------

describe('computeBlackoutReflow — invariants', () => {
  it('preserves play-week count and yields unique, strictly-increasing dates (add)', () => {
    const weeks = seasonWithBreakAndPlayoff();
    const beforePlay = weeks.filter(isPlay).length;
    const plan = computeBlackoutReflow(weeks, {
      kind: 'add',
      date: '2026-07-15',
      reason: 'Holiday',
      skipType: 'blackout',
    });
    const after = applyPlan(weeks, plan);

    expect(after.filter(isPlay)).toHaveLength(beforePlay);
    const dates = after.map((w) => w.date);
    expect(new Set(dates).size).toBe(dates.length); // no duplicate nights
    expect(dates).toEqual([...dates].sort()); // strictly increasing after sort
  });

  it('preserves play-week count and unique dates (remove)', () => {
    const weeks = [
      wk('2026-07-01', 'regular', 'Week 1'),
      wk('2026-07-08', 'blackout', 'Holiday'),
      wk('2026-07-15', 'regular', 'Week 2'),
      wk('2026-07-22', 'playoffs', 'Playoffs'),
    ];
    const beforePlay = weeks.filter(isPlay).length;
    const plan = computeBlackoutReflow(weeks, { kind: 'remove', date: '2026-07-08' });
    const after = applyPlan(weeks, plan);

    expect(after.filter(isPlay)).toHaveLength(beforePlay);
    const dates = after.map((w) => w.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('never re-dates a skip row (only play weeks appear in dateUpdates)', () => {
    const weeks = seasonWithBreakAndPlayoff();
    const plan = computeBlackoutReflow(weeks, {
      kind: 'add',
      date: '2026-07-08',
      reason: 'Holiday',
      skipType: 'blackout',
    });
    const skipIds = new Set(weeks.filter((w) => !isPlay(w)).map((w) => w.id));
    expect(plan.dateUpdates.every((u) => !skipIds.has(u.id))).toBe(true);
  });
});
