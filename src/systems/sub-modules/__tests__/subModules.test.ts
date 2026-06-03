/**
 * @fileoverview Tests for the SubModule registry + per-system wiring.
 */

import { describe, it, expect } from 'vitest';
import {
  anonymousSubModule,
  doubleDutySubModule,
  defaultEnabledSubs,
} from '../index';
import { bca3v3 } from '@/systems/bca3v3';
import { bca5v5 } from '@/systems/bca5v5';
import { fargo5v5 } from '@/systems/fargo5v5';

describe('anonymousSubModule', () => {
  it('declares kind, label, dropdown value, max', () => {
    expect(anonymousSubModule.kind).toBe('anonymous');
    expect(anonymousSubModule.displayLabel).toBe('Anonymous Sub');
    expect(anonymousSubModule.dropdownValue).toBe('__anonymous_sub__');
    expect(anonymousSubModule.maxPerLineup).toBe(1);
  });
});

describe('doubleDutySubModule', () => {
  it('declares kind, label, dropdown value, max', () => {
    expect(doubleDutySubModule.kind).toBe('double_duty');
    expect(doubleDutySubModule.displayLabel).toBe('Double Duty');
    expect(doubleDutySubModule.dropdownValue).toBe('__double_duty__');
    expect(doubleDutySubModule.maxPerLineup).toBe(1);
  });
});

describe('defaultEnabledSubs', () => {
  it('includes both anonymous and double-duty', () => {
    expect(defaultEnabledSubs).toHaveLength(2);
    expect(defaultEnabledSubs.map((s) => s.kind)).toEqual([
      'anonymous',
      'double_duty',
    ]);
  });
});

describe('shipping presets enable both sub kinds', () => {
  it('bca3v3 has both anonymous and double-duty enabled', () => {
    expect(bca3v3.enabledSubs).toHaveLength(2);
    expect(bca3v3.enabledSubs.map((s) => s.kind).sort()).toEqual([
      'anonymous',
      'double_duty',
    ]);
  });

  it('bca5v5 has both anonymous and double-duty enabled', () => {
    expect(bca5v5.enabledSubs).toHaveLength(2);
    expect(bca5v5.enabledSubs.map((s) => s.kind).sort()).toEqual([
      'anonymous',
      'double_duty',
    ]);
  });

  it('fargo5v5 has both anonymous and double-duty enabled', () => {
    expect(fargo5v5.enabledSubs).toHaveLength(2);
    expect(fargo5v5.enabledSubs.map((s) => s.kind).sort()).toEqual([
      'anonymous',
      'double_duty',
    ]);
  });
});
