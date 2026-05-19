/**
 * @fileoverview Tests for age calculation utilities.
 *
 * Uses fake timers to pin "today" to a known date so birthday-boundary
 * assertions are deterministic across timezones and machine clocks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateAge, isMinor } from '../age';

const FIXED_TODAY = '2026-05-12';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 4, 12)); // May 12, 2026 in local time
});

afterEach(() => {
  vi.useRealTimers();
});

describe('calculateAge', () => {
  it('returns null for missing DOB', () => {
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge(undefined)).toBeNull();
    expect(calculateAge('')).toBeNull();
  });

  it('returns null for malformed DOB strings', () => {
    expect(calculateAge('not-a-date')).toBeNull();
    expect(calculateAge('2026/05/12')).toBeNull();
    expect(calculateAge('05-12-2026')).toBeNull();
  });

  it('returns whole years between DOB and today', () => {
    expect(calculateAge('2000-05-12')).toBe(26); // birthday lands today
    expect(calculateAge('2000-01-01')).toBe(26); // earlier in year
    expect(calculateAge('2025-05-12')).toBe(1); // exactly 1 year ago
  });

  it('does not count the current year if the birthday has not yet happened', () => {
    expect(calculateAge('2010-05-13')).toBe(15); // birthday tomorrow → 15, not 16
    expect(calculateAge('2010-12-31')).toBe(15); // birthday later in year
  });

  it('counts the current year on the exact birthday', () => {
    expect(calculateAge('2010-05-12')).toBe(16); // today is the birthday
  });
});

describe('isMinor', () => {
  it('returns false for unknown DOB (null / undefined / empty)', () => {
    expect(isMinor(null)).toBe(false);
    expect(isMinor(undefined)).toBe(false);
    expect(isMinor('')).toBe(false);
  });

  it('returns true for someone clearly under 18', () => {
    expect(isMinor('2015-01-01')).toBe(true); // 11 years old
    expect(isMinor('2010-06-01')).toBe(true); // 15 (birthday hasn't happened)
  });

  it('returns true for someone exactly one day before their 18th birthday', () => {
    // Born 2008-05-13 → on 2026-05-12 they're 17 (turning 18 tomorrow)
    expect(isMinor('2008-05-13')).toBe(true);
  });

  it('returns false on the exact 18th birthday — turning 18 today flips to adult', () => {
    expect(isMinor('2008-05-12')).toBe(false);
  });

  it('returns false for clearly adult members', () => {
    expect(isMinor('2000-01-01')).toBe(false);
    expect(isMinor('1990-12-31')).toBe(false);
  });
});

/* eslint-disable @typescript-eslint/no-unused-vars */
// Surface the fake-date constant so the file remains self-documenting
// even when read in isolation by future maintainers.
const _ = FIXED_TODAY;
