/**
 * @fileoverview Tests for season-length edit eligibility + bounds (seasonLengthEdit.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  isLengthEditable,
  classifyLengthChange,
  type LengthEditWeek,
} from './seasonLengthEdit';

// --- Helpers ---------------------------------------------------------------

/** Build N regular weeks on consecutive Wednesdays from a start date. */
function regulars(startIso: string, n: number): LengthEditWeek[] {
  const [y, m, d] = startIso.split('-').map(Number);
  const out: LengthEditWeek[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(y, m - 1, d + i * 7);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    out.push({ date: iso, weekType: 'regular' });
  }
  return out;
}

// --- isLengthEditable ------------------------------------------------------

describe('isLengthEditable', () => {
  it('is editable before the 5th regular week date', () => {
    // weeks 1..16 on Wednesdays from 2026-07-01; week 5 = 2026-07-29
    const weeks = regulars('2026-07-01', 16);
    expect(isLengthEditable(weeks, '2026-07-20')).toBe(true);
  });

  it('is NOT editable exactly on the 5th week date (boundary)', () => {
    const weeks = regulars('2026-07-01', 16); // week 5 = 2026-07-29
    expect(isLengthEditable(weeks, '2026-07-29')).toBe(false);
  });

  it('is NOT editable after the 5th week date', () => {
    const weeks = regulars('2026-07-01', 16);
    expect(isLengthEditable(weeks, '2026-08-15')).toBe(false);
  });

  it('treats a partially-built schedule (<5 regular weeks) as editable', () => {
    const weeks = regulars('2026-07-01', 3);
    expect(isLengthEditable(weeks, '2026-12-31')).toBe(true);
  });

  it('ignores non-regular weeks when finding the 5th regular week', () => {
    const weeks: LengthEditWeek[] = [
      ...regulars('2026-07-01', 16),
      { date: '2026-07-15', weekType: 'blackout' },
      { date: '2026-12-01', weekType: 'playoffs' },
    ];
    // 5th REGULAR week is still 2026-07-29, not shifted by the blackout row
    expect(isLengthEditable(weeks, '2026-07-29')).toBe(false);
    expect(isLengthEditable(weeks, '2026-07-28')).toBe(true);
  });

  it('locks regardless of date when paymentMade is set (future seam)', () => {
    const weeks = regulars('2026-07-01', 16);
    expect(isLengthEditable(weeks, '2026-07-01', { paymentMade: true })).toBe(false);
  });
});

// --- classifyLengthChange --------------------------------------------------

describe('classifyLengthChange', () => {
  it('classifies a lengthen with positive delta', () => {
    expect(classifyLengthChange(16, 18)).toEqual({ kind: 'lengthen', delta: 2 });
  });

  it('classifies a shorten with positive delta', () => {
    expect(classifyLengthChange(16, 12)).toEqual({ kind: 'shorten', delta: 4 });
  });

  it('classifies an unchanged length as noop', () => {
    expect(classifyLengthChange(16, 16)).toEqual({ kind: 'noop' });
  });

  it('rejects below the floor', () => {
    expect(classifyLengthChange(16, 9)).toEqual({
      kind: 'invalid',
      reason: 'Seasons must be at least 10 weeks.',
    });
  });

  it('rejects above the ceiling', () => {
    expect(classifyLengthChange(16, 53)).toEqual({
      kind: 'invalid',
      reason: 'Seasons can be at most 52 weeks.',
    });
  });

  it('rejects a non-integer length', () => {
    expect(classifyLengthChange(16, 14.5).kind).toBe('invalid');
  });

  it('accepts the exact bounds', () => {
    expect(classifyLengthChange(16, 10)).toEqual({ kind: 'shorten', delta: 6 });
    expect(classifyLengthChange(16, 52)).toEqual({ kind: 'lengthen', delta: 36 });
  });
});
