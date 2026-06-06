/**
 * @fileoverview Save-time guard tests for the trigger room.
 *
 * The guard is the first of four layers between an editor save and the
 * runtime. It must:
 *   - accept the four seeded official patterns (match_start / anytime /
 *     match_end × always / compare × set / expr)
 *   - reject empty names
 *   - reject writes to targets outside the v1 whitelist
 *     (home_points / away_points)
 *   - reject expressions that throw under the synthetic dry-run
 */

import { describe, it, expect } from 'vitest';
import { runSaveTimeGuard } from '../saveTimeGuard';
import type { Trigger } from '@/systems/points-system/types';

function base(overrides: Partial<Trigger> = {}): Trigger {
  return {
    name: 'test',
    type: 'match_start',
    condition: { kind: 'always' },
    action: { target: 'home_points', value: { kind: 'set', value: 0 } },
    rearm: 'single_shot',
    order: { number: 0, beforeAllocator: false },
    ...overrides,
  };
}

describe('runSaveTimeGuard — accepts the four seeded official patterns', () => {
  it('accepts match_start + always + set (Initial credit shape)', () => {
    const result = runSaveTimeGuard(
      base({
        name: 'Initial credit',
        type: 'match_start',
        condition: { kind: 'always' },
        action: { target: 'home_points', value: { kind: 'set', value: 50 } },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts anytime + compare + expr (Game-13 bonus shape)', () => {
    const result = runSaveTimeGuard(
      base({
        name: 'Game-13 bonus',
        type: 'anytime',
        condition: {
          kind: 'compare',
          left: { kind: 'var', name: 'games_played' },
          op: '==',
          right: { kind: 'const', value: 13 },
        },
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
    );
    expect(result.ok).toBe(true);
  });

  it('accepts match_end + compare + expr (Sweep bonus shape)', () => {
    const result = runSaveTimeGuard(
      base({
        name: 'Sweep bonus',
        type: 'match_end',
        condition: {
          kind: 'compare',
          left: { kind: 'var', name: 'home_wins' },
          op: '>',
          right: { kind: 'const', value: 20 },
        },
        action: {
          target: 'home_points',
          value: {
            kind: 'expr',
            expr: {
              kind: 'op',
              op: '+',
              left: { kind: 'var', name: 'home_points' },
              right: { kind: 'const', value: 10 },
            },
          },
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts the Empty Starter shape (no-op)', () => {
    const result = runSaveTimeGuard(
      base({
        name: 'Empty Starter copy',
        type: 'match_start',
        condition: { kind: 'always' },
        action: { target: 'home_points', value: { kind: 'set', value: 0 } },
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('runSaveTimeGuard — structural rejections', () => {
  it('rejects an empty name', () => {
    const result = runSaveTimeGuard(base({ name: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/name is empty/);
    }
  });

  it('rejects a whitespace-only name', () => {
    const result = runSaveTimeGuard(base({ name: '   ' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a target outside the v1 whitelist', () => {
    const result = runSaveTimeGuard(
      base({
        action: { target: 'edge', value: { kind: 'set', value: 'home' } },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/edge/);
    }
  });

  it('accepts away_points as a target', () => {
    const result = runSaveTimeGuard(
      base({
        action: { target: 'away_points', value: { kind: 'set', value: 25 } },
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('runSaveTimeGuard — dry-run safety', () => {
  it('accepts a divide expression that produces a finite result (denominator non-zero in synthetic state)', () => {
    // total_games is 5 in the synthetic inputs, so home_points / total_games is finite.
    const result = runSaveTimeGuard(
      base({
        name: 'safe divide',
        action: {
          target: 'home_points',
          value: {
            kind: 'expr',
            expr: {
              kind: 'op',
              op: '/',
              left: { kind: 'var', name: 'home_points' },
              right: { kind: 'var', name: 'total_games' },
            },
          },
        },
      }),
    );
    expect(result.ok).toBe(true);
  });
});
