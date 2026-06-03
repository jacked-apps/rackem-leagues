/**
 * @fileoverview Tests for each system's `handicapEntry` config.
 *
 * Asserts the dial values match what each system claims to be, and
 * that `displayFormat` produces today's output for representative
 * values (byte-equivalence with the existing per-system displayFormat
 * at lookup time).
 */

import { describe, it, expect } from 'vitest';
import { pointsHandicapSystem } from '../points';
import { percentageHandicapSystem } from '../percentage';
import { fargoRateHandicapSystem } from '../fargorate';
import { skillLevelHandicapSystem } from '../skill-level';

describe('Points handicapEntry', () => {
  const entry = pointsHandicapSystem.handicapEntry;

  it('uses a select widget with the -2..+2 enum', () => {
    expect(entry.inputKind).toBe('select');
    expect(entry.range).toBeNull();
    expect(entry.enumValues).not.toBeNull();
    expect(entry.enumValues?.map((o) => o.value)).toEqual([2, 1, 0, -1, -2]);
    expect(entry.enumValues?.map((o) => o.label)).toEqual([
      '+2',
      '+1',
      '0',
      '-1',
      '-2',
    ]);
  });

  it('declares H/C column header and narrow width', () => {
    expect(entry.columnHeader).toBe('H/C');
    expect(entry.columnWidth).toBe('narrow');
  });

  it('source is auto-from-history (derived, not manually entered)', () => {
    expect(entry.source).toBe('auto-from-history');
  });

  it('displayFormat preserves the existing per-system output', () => {
    expect(entry.displayFormat(2)).toBe('+2');
    expect(entry.displayFormat(0)).toBe('0');
    expect(entry.displayFormat(-1)).toBe('-1');
    expect(entry.displayFormat(null)).toBe('');
  });
});

describe('Percentage handicapEntry', () => {
  const entry = percentageHandicapSystem.handicapEntry;

  it('uses a number widget bounded to 0..100', () => {
    expect(entry.inputKind).toBe('number');
    expect(entry.range).toEqual({ min: 0, max: 100, integer: false });
    expect(entry.enumValues).toBeNull();
  });

  it('declares H/C column header, narrow width, % placeholder', () => {
    expect(entry.columnHeader).toBe('H/C');
    expect(entry.columnWidth).toBe('narrow');
    expect(entry.placeholderText).toBe('%');
  });

  it('source is auto-from-history', () => {
    expect(entry.source).toBe('auto-from-history');
  });

  it('displayFormat preserves the existing per-system output', () => {
    expect(entry.displayFormat(85)).toBe('85%');
    expect(entry.displayFormat(30)).toBe('30%');
    expect(entry.displayFormat(null)).toBe('');
  });
});

describe('FargoRate handicapEntry', () => {
  const entry = fargoRateHandicapSystem.handicapEntry;

  it('uses a number widget bounded to 100..1000, integer-only', () => {
    expect(entry.inputKind).toBe('number');
    expect(entry.range).toEqual({ min: 100, max: 1000, integer: true });
    expect(entry.enumValues).toBeNull();
  });

  it('declares Fargo column header, wide width, em-dash placeholder', () => {
    expect(entry.columnHeader).toBe('Fargo');
    expect(entry.columnWidth).toBe('wide');
    expect(entry.placeholderText).toBe('—');
  });

  it('source is manual (FargoRate API access is future work)', () => {
    expect(entry.source).toBe('manual');
  });

  it('displayFormat preserves the existing per-system output', () => {
    expect(entry.displayFormat(575)).toBe('575');
    expect(entry.displayFormat(425)).toBe('425');
    expect(entry.displayFormat(null)).toBe('');
  });
});

describe('Skill Level handicapEntry', () => {
  const entry = skillLevelHandicapSystem.handicapEntry;

  it('uses a number widget bounded to 1..9, integer-only', () => {
    expect(entry.inputKind).toBe('number');
    expect(entry.range).toEqual({ min: 1, max: 9, integer: true });
    expect(entry.enumValues).toBeNull();
  });

  it('declares Skill column header, narrow width, SL placeholder', () => {
    expect(entry.columnHeader).toBe('Skill');
    expect(entry.columnWidth).toBe('narrow');
    expect(entry.placeholderText).toBe('SL');
  });

  it('source is manual (APA assigns externally)', () => {
    expect(entry.source).toBe('manual');
  });

  it('displayFormat preserves the existing per-system output', () => {
    expect(entry.displayFormat(5)).toBe('SL5');
    expect(entry.displayFormat(8)).toBe('SL8');
    expect(entry.displayFormat(null)).toBe('');
  });
});
