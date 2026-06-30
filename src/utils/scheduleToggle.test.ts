/**
 * @fileoverview Tests for the pure week-off toggle decisions (scheduleToggle.ts).
 */
import { describe, it, expect } from 'vitest';
import { isPastOrPlayed, decideToggle, type ToggleWeek } from './scheduleToggle';

const week = (over: Partial<ToggleWeek>): ToggleWeek => ({
  date: '2026-07-15',
  weekCompleted: false,
  dbWeekType: 'regular',
  ...over,
});

describe('isPastOrPlayed', () => {
  it('is true for a date before today', () => {
    expect(isPastOrPlayed(week({ date: '2026-07-01' }), '2026-07-10')).toBe(true);
  });

  it('is true for a played week even if its date is in the future', () => {
    expect(isPastOrPlayed(week({ date: '2026-07-20', weekCompleted: true }), '2026-07-10')).toBe(true);
  });

  it('is false for a future, unplayed week', () => {
    expect(isPastOrPlayed(week({ date: '2026-07-20' }), '2026-07-10')).toBe(false);
  });
});

describe('decideToggle', () => {
  it('removes a blackout skip', () => {
    expect(decideToggle(week({ dbWeekType: 'blackout' }))).toEqual({ action: 'remove' });
  });

  // A season-end break is now just a blackout (collapsed type), so removing one
  // is covered by 'removes a blackout skip' above.

  it('inserts a season-end break (a labelled blackout) on a playoff week (no reason needed)', () => {
    expect(decideToggle(week({ dbWeekType: 'playoffs' }))).toEqual({
      action: 'add',
      skipType: 'blackout',
      reason: 'Season End Break',
    });
  });

  it('prompts for a reason on a regular play week', () => {
    expect(decideToggle(week({ dbWeekType: 'regular' }))).toEqual({ action: 'prompt-blackout' });
  });
});
