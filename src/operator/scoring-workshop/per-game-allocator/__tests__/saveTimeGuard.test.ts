/**
 * @fileoverview Tests for the editor's save-time guard.
 *
 * Guard's job: refuse to persist anything that fails the structural
 * validator OR throws during a small synthetic dry-run through
 * evaluatePointsSystem. This is the first of four guard layers.
 */

import { describe, it, expect, vi } from 'vitest';
import { runSaveTimeGuard } from '../saveTimeGuard';
import type { PerGameAllocator } from '@/systems/points-system/types';
// Side-effect: register the formula op used in the formula-path tests.
import '@/systems/points-system/allocator-formula-operations/add-complement-of-other-side';
import '@/systems/points-system/allocator-formula-operations/read-state-var';

describe('runSaveTimeGuard', () => {
  it('accepts a simple fixed/fixed allocator', () => {
    const a: PerGameAllocator = {
      name: 'eleven',
      winner: { base: 11, formula: null },
      loser: { base: 0, formula: null },
    };
    expect(runSaveTimeGuard(a)).toEqual({ ok: true });
  });

  it('accepts a fixed/range allocator (10-Point shape)', () => {
    const a: PerGameAllocator = {
      name: 'ten_point',
      winner: { base: 10, formula: null },
      loser: {
        base: { min: 0, max: 7, label: 'Balls pocketed by loser' },
        formula: null,
      },
    };
    expect(runSaveTimeGuard(a)).toEqual({ ok: true });
  });

  it('accepts a 17-Point formula allocator', () => {
    const a: PerGameAllocator = {
      name: 'seventeen',
      winner: {
        base: 10,
        formula: {
          operationKind: 'add_complement_of_other_side',
          operationArgs: { max: 7, other_side: 'loser' },
        },
      },
      loser: {
        base: { min: 0, max: 7, label: 'Balls pocketed by loser' },
        formula: null,
      },
    };
    expect(runSaveTimeGuard(a)).toEqual({ ok: true });
  });

  it('rejects an unregistered formula op (structural validation)', () => {
    const a: PerGameAllocator = {
      name: 'broken',
      winner: {
        base: 10,
        formula: { operationKind: 'totally_made_up', operationArgs: {} },
      },
      loser: { base: 0, formula: null },
    };
    const r = runSaveTimeGuard(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unknown formula operation/);
  });

  it('rejects missing required formula args (Unit 3 hardening)', () => {
    const a: PerGameAllocator = {
      name: 'missing_max',
      winner: {
        base: 10,
        formula: {
          operationKind: 'add_complement_of_other_side',
          operationArgs: { other_side: 'loser' }, // max missing
        },
      },
      loser: { base: 0, formula: null },
    };
    const r = runSaveTimeGuard(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/missing required arg "max"/);
  });

  it("rejects a string where a number is expected (max: 'seven')", () => {
    const a: PerGameAllocator = {
      name: 'string_max',
      winner: {
        base: 10,
        formula: {
          operationKind: 'add_complement_of_other_side',
          operationArgs: { max: 'seven', other_side: 'loser' },
        },
      },
      loser: { base: 0, formula: null },
    };
    const r = runSaveTimeGuard(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/wrong type/);
  });

  it('accepts a read_state_var variation (R11)', () => {
    const a: PerGameAllocator = {
      name: 'state_reader',
      winner: {
        base: 0,
        formula: {
          operationKind: 'read_state_var',
          operationArgs: { var_name: 'pointsPerGame' },
        },
      },
      loser: { base: 0, formula: null },
    };
    // The dry-run state bag has no pointsPerGame; read_state_var returns 0
    // + warn. That's allowed — the dry-run only fails on NaN/Infinity or
    // a throw. Suppress the noise for cleanliness.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(runSaveTimeGuard(a)).toEqual({ ok: true });
    warnSpy.mockRestore();
  });
});
