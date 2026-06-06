/**
 * @fileoverview Tests for the standalone `validateTrigger` extraction
 * (Unit 3 of the trigger room). The function is called by:
 *   - `validatePointsSystem` (for every trigger in a composition)
 *   - The trigger room's loader at read time
 *   - The trigger room's save-time guard inside the editor
 *
 * These tests cover the structural checks and the optional
 * `allowedTargets` whitelist (the trigger room's v1 write-target
 * restriction).
 */

import { describe, it, expect } from 'vitest';
import { validateTrigger } from '../composition-validator';
import type { Trigger } from '../types';

function baseTrigger(overrides: Partial<Trigger> = {}): Trigger {
  return {
    name: 'test_trigger',
    type: 'match_start',
    condition: { kind: 'always' },
    action: {
      target: 'home_points',
      value: { kind: 'set', value: 10 },
    },
    rearm: 'single_shot',
    order: { number: 1, beforeAllocator: false },
    ...overrides,
  };
}

describe('validateTrigger — structural checks', () => {
  it('accepts a minimal valid trigger', () => {
    expect(() => validateTrigger(baseTrigger())).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => validateTrigger(baseTrigger({ name: '' }))).toThrow(
      /name is empty/,
    );
  });

  it('rejects a whitespace-only name', () => {
    expect(() => validateTrigger(baseTrigger({ name: '   ' }))).toThrow(
      /name is empty/,
    );
  });

  it('rejects an invalid type', () => {
    expect(() =>
      validateTrigger(baseTrigger({ type: 'banana_phase' as unknown as Trigger['type'] })),
    ).toThrow(/invalid type/);
  });

  it('rejects an invalid condition shape', () => {
    expect(() =>
      validateTrigger(
        baseTrigger({
          condition: { kind: 'banana' as unknown as 'always' } as Trigger['condition'],
        }),
      ),
    ).toThrow(/invalid condition shape/);
  });

  it('accepts a compare condition', () => {
    expect(() =>
      validateTrigger(
        baseTrigger({
          condition: {
            kind: 'compare',
            left: { kind: 'var', name: 'home_wins' },
            op: '>',
            right: { kind: 'const', value: 10 },
          },
        }),
      ),
    ).not.toThrow();
  });

  it('rejects an empty action target', () => {
    expect(() =>
      validateTrigger(
        baseTrigger({ action: { target: '', value: { kind: 'set', value: 0 } } }),
      ),
    ).toThrow(/action\.target must be a non-empty string/);
  });

  it('rejects an invalid action value shape', () => {
    expect(() =>
      validateTrigger(
        baseTrigger({
          action: {
            target: 'home_points',
            value: { kind: 'banana' } as unknown as Trigger['action']['value'],
          },
        }),
      ),
    ).toThrow(/invalid action value shape/);
  });

  it('accepts an expr action', () => {
    expect(() =>
      validateTrigger(
        baseTrigger({
          action: {
            target: 'home_points',
            value: {
              kind: 'expr',
              expr: {
                kind: 'op',
                op: '+',
                left: { kind: 'var', name: 'home_points' },
                right: { kind: 'const', value: 5 },
              },
            },
          },
        }),
      ),
    ).not.toThrow();
  });

  it('rejects an invalid rearm', () => {
    expect(() =>
      validateTrigger(baseTrigger({ rearm: 'on_demand' as unknown as Trigger['rearm'] })),
    ).toThrow(/invalid rearm/);
  });
});

describe('validateTrigger — allowedTargets whitelist (trigger room v1 restriction)', () => {
  it('rejects a target outside the whitelist when one is provided', () => {
    expect(() =>
      validateTrigger(
        baseTrigger({
          action: {
            target: 'edge',
            value: { kind: 'set', value: 'home' },
          },
        }),
        { allowedTargets: ['home_points', 'away_points'] },
      ),
    ).toThrow(/action target "edge" is not in the allowed set/);
  });

  it('accepts home_points and away_points under the whitelist', () => {
    expect(() =>
      validateTrigger(
        baseTrigger({
          action: { target: 'home_points', value: { kind: 'set', value: 50 } },
        }),
        { allowedTargets: ['home_points', 'away_points'] },
      ),
    ).not.toThrow();
    expect(() =>
      validateTrigger(
        baseTrigger({
          action: { target: 'away_points', value: { kind: 'set', value: 50 } },
        }),
        { allowedTargets: ['home_points', 'away_points'] },
      ),
    ).not.toThrow();
  });

  it('accepts any target when no whitelist is provided (prepackaged composition path)', () => {
    expect(() =>
      validateTrigger(
        baseTrigger({
          action: { target: 'edge', value: { kind: 'set', value: 'home' } },
        }),
      ),
    ).not.toThrow();
  });
});
