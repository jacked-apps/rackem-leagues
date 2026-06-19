/**
 * @fileoverview Unit tests for deriveWeekLabels — the derive-don't-store week label helper.
 *
 * The whole point of the schedule ⇄ matchup decoupling: "Week N" is counted from a
 * regular week's position by date, never read from a stored string. These tests pin the
 * counting rule and prove it self-heals seasons whose stored labels are wrong.
 */
import { describe, it, expect } from 'vitest';
import { deriveWeekLabels } from '@/utils/scheduleDisplayUtils';
import type { SeasonWeek } from '@/types/season';

/**
 * Minimal SeasonWeek factory. `date` drives ordering; `week_name` is intentionally
 * allowed to be WRONG in some tests to prove the helper ignores stored numbers.
 */
function wk(overrides: Partial<SeasonWeek> & { id: string; scheduled_date: string }): SeasonWeek {
  return {
    season_id: 'season-1',
    week_name: '',
    week_type: 'regular',
    week_completed: false,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('deriveWeekLabels', () => {
  it('numbers regular weeks 1..N by date, skipping an interspersed blackout', () => {
    const weeks: SeasonWeek[] = [
      wk({ id: 'r1', scheduled_date: '2026-01-07', week_type: 'regular' }),
      wk({ id: 'b1', scheduled_date: '2026-01-14', week_type: 'blackout', week_name: 'MLK Day' }),
      wk({ id: 'r2', scheduled_date: '2026-01-21', week_type: 'regular' }),
      wk({ id: 'r3', scheduled_date: '2026-01-28', week_type: 'regular' }),
    ];

    const labels = deriveWeekLabels(weeks);

    expect(labels.get('r1')).toBe('Week 1');
    expect(labels.get('r2')).toBe('Week 2'); // not "Week 3" — the blackout is not counted
    expect(labels.get('r3')).toBe('Week 3');
    expect(labels.get('b1')).toBe('MLK Day'); // blackout shows its label, no number
  });

  it('self-heals a season whose stored week_name is mis-numbered (the prod bug)', () => {
    // Stored labels read 1, 3, 4 — the real prod bug where a blackout bumped the count.
    const weeks: SeasonWeek[] = [
      wk({ id: 'r1', scheduled_date: '2026-02-04', week_type: 'regular', week_name: 'Week 1' }),
      wk({ id: 'b1', scheduled_date: '2026-02-11', week_type: 'blackout', week_name: 'Holiday' }),
      wk({ id: 'r2', scheduled_date: '2026-02-18', week_type: 'regular', week_name: 'Week 3' }),
      wk({ id: 'r3', scheduled_date: '2026-02-25', week_type: 'regular', week_name: 'Week 4' }),
    ];

    const labels = deriveWeekLabels(weeks);

    // Derived purely from position — the bad stored strings are ignored.
    expect(labels.get('r2')).toBe('Week 2');
    expect(labels.get('r3')).toBe('Week 3');
  });

  it('counts the first regular week as Week 1 even when a blackout comes first', () => {
    const weeks: SeasonWeek[] = [
      wk({ id: 'b1', scheduled_date: '2026-03-04', week_type: 'blackout', week_name: 'Spring Break' }),
      wk({ id: 'r1', scheduled_date: '2026-03-11', week_type: 'regular' }),
    ];

    expect(deriveWeekLabels(weeks).get('r1')).toBe('Week 1');
  });

  it('ignores input order (sorts a copy by date)', () => {
    const weeks: SeasonWeek[] = [
      wk({ id: 'r3', scheduled_date: '2026-04-22', week_type: 'regular' }),
      wk({ id: 'r1', scheduled_date: '2026-04-08', week_type: 'regular' }),
      wk({ id: 'r2', scheduled_date: '2026-04-15', week_type: 'regular' }),
    ];

    const labels = deriveWeekLabels(weeks);
    expect(labels.get('r1')).toBe('Week 1');
    expect(labels.get('r2')).toBe('Week 2');
    expect(labels.get('r3')).toBe('Week 3');
  });

  it('labels a single playoff week "Playoffs" and multiple as "Playoffs Week k"', () => {
    const single: SeasonWeek[] = [
      wk({ id: 'r1', scheduled_date: '2026-05-06', week_type: 'regular' }),
      wk({ id: 'p1', scheduled_date: '2026-05-13', week_type: 'playoffs' }),
    ];
    expect(deriveWeekLabels(single).get('p1')).toBe('Playoffs');

    const multi: SeasonWeek[] = [
      wk({ id: 'p1', scheduled_date: '2026-05-13', week_type: 'playoffs' }),
      wk({ id: 'p2', scheduled_date: '2026-05-20', week_type: 'playoffs' }),
    ];
    const labels = deriveWeekLabels(multi);
    expect(labels.get('p1')).toBe('Playoffs Week 1');
    expect(labels.get('p2')).toBe('Playoffs Week 2');
  });

  it('reads a blackout label from notes when present, else falls back to week_name', () => {
    const weeks: SeasonWeek[] = [
      wk({ id: 'b1', scheduled_date: '2026-06-03', week_type: 'blackout', week_name: 'old', notes: 'Independence Day' }),
      wk({ id: 'b2', scheduled_date: '2026-06-10', week_type: 'blackout', week_name: 'APA Nationals', notes: null }),
    ];
    const labels = deriveWeekLabels(weeks);
    expect(labels.get('b1')).toBe('Independence Day'); // notes wins
    expect(labels.get('b2')).toBe('APA Nationals'); // falls back to week_name
  });

  it('treats the legacy season_end_break as a labeled skip (no number)', () => {
    const weeks: SeasonWeek[] = [
      wk({ id: 'r1', scheduled_date: '2026-07-01', week_type: 'regular' }),
      wk({ id: 's1', scheduled_date: '2026-07-08', week_type: 'season_end_break', week_name: 'Week Off' }),
    ];
    const labels = deriveWeekLabels(weeks);
    expect(labels.get('r1')).toBe('Week 1');
    expect(labels.get('s1')).toBe('Week Off');
  });

  it('handles edge cases without crashing (single regular week; all-blackout season)', () => {
    expect(deriveWeekLabels([wk({ id: 'r1', scheduled_date: '2026-08-05' })]).get('r1')).toBe('Week 1');

    const allBlackout: SeasonWeek[] = [
      wk({ id: 'b1', scheduled_date: '2026-08-05', week_type: 'blackout', week_name: 'X' }),
    ];
    const labels = deriveWeekLabels(allBlackout);
    expect(labels.get('b1')).toBe('X');
    expect(labels.size).toBe(1);
  });
});
