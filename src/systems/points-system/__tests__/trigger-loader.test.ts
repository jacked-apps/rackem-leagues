/**
 * @fileoverview Tests for the trigger loader (Unit 2 of the trigger room).
 *
 * Mirrors the per-game-allocator-loader test structure. Every failure path
 * surfaces as `null` + console.warn, never an uncaught throw.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMaybeSingle = vi.fn();

vi.mock('@/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  },
}));

import { loadTrigger } from '../trigger-loader';

const ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  mockMaybeSingle.mockReset();
});

describe('loadTrigger — happy paths', () => {
  it('loads an "Initial credit" style trigger (match_start + always + set)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Initial credit — Official',
        trigger_type: 'match_start',
        condition: { kind: 'always' },
        action: { target: 'home_points', value: { kind: 'set', value: 50 } },
        rearm: 'single_shot',
      },
      error: null,
    });
    const result = await loadTrigger(ID);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('match_start');
    expect(result?.condition.kind).toBe('always');
    expect(result?.action.target).toBe('home_points');
    expect(result?.action.value).toEqual({ kind: 'set', value: 50 });
    // Order defaults are filled in by the loader.
    expect(result?.order).toEqual({ number: 0, beforeAllocator: false });
  });

  it('loads a "Game-13 bonus" style trigger (anytime + compare + expr)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Game-13 bonus — Official',
        trigger_type: 'anytime',
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
        rearm: 'single_shot',
      },
      error: null,
    });
    const result = await loadTrigger(ID);
    expect(result?.condition.kind).toBe('compare');
    expect(result?.action.value.kind).toBe('expr');
  });
});

describe('loadTrigger — not-found and supabase failures', () => {
  it('returns null + warn when the row does not exist', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await loadTrigger(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`no row found for id=${ID}`),
    );
    warnSpy.mockRestore();
  });

  it('returns null + warn when supabase reports an error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'PGRST' } });
    const result = await loadTrigger(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('supabase error'));
    warnSpy.mockRestore();
  });

  it('returns null + warn when supabase throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockRejectedValue(new Error('network down'));
    const result = await loadTrigger(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unexpected error'));
    warnSpy.mockRestore();
  });
});

describe('loadTrigger — malformed JSONB', () => {
  it('returns null + warn when condition is missing kind', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Broken',
        trigger_type: 'match_start',
        condition: { left: { kind: 'const', value: 0 } },
        action: { target: 'home_points', value: { kind: 'set', value: 0 } },
        rearm: 'single_shot',
      },
      error: null,
    });
    const result = await loadTrigger(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('malformed JSONB'));
    warnSpy.mockRestore();
  });

  it('returns null + warn when action.value.kind is unknown', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Broken',
        trigger_type: 'match_start',
        condition: { kind: 'always' },
        action: { target: 'home_points', value: { kind: 'banana' } },
        rearm: 'single_shot',
      },
      error: null,
    });
    const result = await loadTrigger(ID);
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('returns null + warn when expression has an unknown op', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Broken',
        trigger_type: 'match_start',
        condition: { kind: 'always' },
        action: {
          target: 'home_points',
          value: {
            kind: 'expr',
            expr: { kind: 'op', op: '%', left: { kind: 'const', value: 5 }, right: { kind: 'const', value: 2 } },
          },
        },
        rearm: 'single_shot',
      },
      error: null,
    });
    const result = await loadTrigger(ID);
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });
});

describe('loadTrigger — validator rejection (v1 write-target restriction)', () => {
  it('returns null + warn when action.target is outside home_points/away_points', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Edge writer',
        trigger_type: 'match_start',
        condition: { kind: 'always' },
        action: { target: 'edge', value: { kind: 'set', value: 'home' } },
        rearm: 'single_shot',
      },
      error: null,
    });
    const result = await loadTrigger(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('validation rejected'));
    warnSpy.mockRestore();
  });
});
