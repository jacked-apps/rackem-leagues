/**
 * @fileoverview Unit tests for extractHolidayName — strips the parenthetical
 * timing suffix from a conflict name so it can seed a week-off reason.
 */

import { describe, it, expect } from 'vitest';
import { extractHolidayName } from './conflictDetectionUtils';

describe('extractHolidayName', () => {
  it('strips the " (...)" timing suffix', () => {
    expect(extractHolidayName('Christmas (Saturday 2 days before)')).toBe('Christmas');
  });

  it('returns the name unchanged when there is no suffix', () => {
    expect(extractHolidayName('BCA Championship')).toBe('BCA Championship');
  });

  it('only splits on the first " (" so names with later parens survive', () => {
    expect(extractHolidayName("New Year's (Monday) (observed)")).toBe("New Year's");
  });
});
