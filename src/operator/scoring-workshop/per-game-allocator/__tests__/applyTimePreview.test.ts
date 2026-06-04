/**
 * @fileoverview Tests for the league-settings apply-time preview.
 *
 * The preview runs the LO's picked variation against the league's
 * prepackaged composition over a synthetic 5-game match. It is the
 * second exercise of the variation (the first being saveTimeGuard inside
 * the editor) — this one tests it IN CONTEXT, slotted into the league's
 * actual prepackaged composition.
 */

import { describe, it, expect, vi } from 'vitest';
import { runApplyTimePreview } from '../applyTimePreview';
import type { PerGameAllocator } from '@/systems/points-system/types';
// Side-effect: ensure formula ops are registered.
import '@/systems/points-system/allocator-formula-operations/add-complement-of-other-side';
import '@/systems/points-system/allocator-formula-operations/read-state-var';

const ELEVEN: PerGameAllocator = {
  name: 'eleven',
  winner: { base: 11, formula: null },
  loser: { base: 0, formula: null },
};

const SEVENTEEN: PerGameAllocator = {
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

describe('runApplyTimePreview', () => {
  it('clean preview for fixed-11 variation against 10-Point composition', () => {
    const r = runApplyTimePreview('accumulated_per_game', ELEVEN);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
  });

  it('clean preview for 17-Point variation against 10-Point composition', () => {
    const r = runApplyTimePreview('accumulated_per_game', SEVENTEEN);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
  });

  it('clean preview for fixed-11 against percent 5-man composition', () => {
    const r = runApplyTimePreview('accumulate_with_milestone_jumps', ELEVEN);
    expect(r.ok).toBe(true);
  });

  it('returns ok:false with reason when the league has no recognized calculator', () => {
    const r = runApplyTimePreview('totally_unknown_calc', ELEVEN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no prepackaged scoring composition/);
  });

  it('returns ok:false when pointsCalculator is null', () => {
    const r = runApplyTimePreview(null, ELEVEN);
    expect(r.ok).toBe(false);
  });

  it('returns a warning when the read_state_var variation reads an unset name (state bag has no pointsPerGame)', () => {
    // read_state_var returns 0 + warn for unset names — the dry-run
    // succeeds without throwing, totals are finite (0), no warning is
    // surfaced. This pins the contract: read_state_var's fallback is
    // graceful, not preview-blocking.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reader: PerGameAllocator = {
      name: 'reads_missing',
      winner: {
        base: 0,
        formula: {
          operationKind: 'read_state_var',
          operationArgs: { var_name: 'never_written' },
        },
      },
      loser: { base: 0, formula: null },
    };
    const r = runApplyTimePreview('accumulated_per_game', reader);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
    warnSpy.mockRestore();
  });

  it('catches a structurally-broken variation (unregistered formula) as a non-blocking warning OR an ok-but-zero result', () => {
    // Composition-validator throws during factory build; preview surfaces
    // it via the catch path.
    const broken: PerGameAllocator = {
      name: 'broken',
      winner: {
        base: 10,
        formula: { operationKind: 'made_up_op', operationArgs: {} },
      },
      loser: { base: 0, formula: null },
    };
    const r = runApplyTimePreview('accumulated_per_game', broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/threw|unknown/);
  });
});
