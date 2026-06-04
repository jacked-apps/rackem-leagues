/**
 * @fileoverview Tests for the per-game allocator loader (Unit 2).
 *
 * The loader is the never-throw bridge between a DB row and the runtime's
 * in-memory `PerGameAllocator` shape. These tests exercise every failure
 * path the loader is supposed to absorb: row-not-found, supabase errors,
 * malformed JSONB, unregistered formula ops, and unexpected exceptions.
 * Each is expected to surface as `null` + a `console.warn`, never an
 * uncaught throw.
 *
 * The supabase client is mocked at the module boundary. Real-DB integration
 * coverage lives in `src/__tests__/database/per-game-allocator-schema.test.ts`
 * (Unit 1) — that file confirms the table + seed are present; this file
 * confirms the loader's behavior across the input space.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Side-effect import: register the formula operation the happy-path 17-Point
// fixture references. The loader's validator checks operationKind resolves;
// these registrations make it resolve.
import '../allocator-formula-operations/add-complement-of-other-side';

// ============================================================================
// Mock the supabase client at the module boundary
// ============================================================================

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

// IMPORTANT: import the SUT AFTER the mock is declared so the mocked
// supabase client is the one the loader closes over.
import { loadPerGameAllocator } from '../per-game-allocator-loader';

const ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  mockMaybeSingle.mockReset();
});

// ============================================================================
// Happy paths
// ============================================================================

describe('loadPerGameAllocator — happy paths', () => {
  it('loads a fixed/fixed variation (Percent 5-Man shape)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Percent 5-Man — Official',
        winner_side: { base: 0.1, formula: null },
        loser_side: { base: 0, formula: null },
      },
      error: null,
    });
    const result = await loadPerGameAllocator(ID);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Percent 5-Man — Official');
    expect(result?.winner.base).toBe(0.1);
    expect(result?.winner.formula).toBeNull();
    expect(result?.loser.base).toBe(0);
    expect(result?.loser.formula).toBeNull();
  });

  it('loads a fixed/range variation (10-Point shape)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: '10-Point — Official',
        winner_side: { base: 10, formula: null },
        loser_side: {
          base: { min: 0, max: 7, label: 'Balls pocketed by loser' },
          formula: null,
        },
      },
      error: null,
    });
    const result = await loadPerGameAllocator(ID);
    expect(result?.winner.base).toBe(10);
    expect(result?.loser.base).toEqual({
      min: 0,
      max: 7,
      label: 'Balls pocketed by loser',
    });
  });

  it('loads a formula/range variation (17-Point shape)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: '17-Point — Official',
        winner_side: {
          base: 10,
          formula: {
            operationKind: 'add_complement_of_other_side',
            operationArgs: { max: 7, other_side: 'loser' },
          },
        },
        loser_side: {
          base: { min: 0, max: 7, label: 'Balls pocketed by loser' },
          formula: null,
        },
      },
      error: null,
    });
    const result = await loadPerGameAllocator(ID);
    expect(result?.winner.formula).toEqual({
      operationKind: 'add_complement_of_other_side',
      operationArgs: { max: 7, other_side: 'loser' },
    });
  });
});

// ============================================================================
// Not-found + supabase failure modes
// ============================================================================

describe('loadPerGameAllocator — not-found and supabase failures', () => {
  it('returns null + warn when the row does not exist', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await loadPerGameAllocator(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`no row found for id=${ID}`),
    );
    warnSpy.mockRestore();
  });

  it('returns null + warn when supabase reports an error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'PGRST something' },
    });
    const result = await loadPerGameAllocator(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('supabase error'),
    );
    warnSpy.mockRestore();
  });

  it('returns null + warn when supabase throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockRejectedValue(new Error('network down'));
    const result = await loadPerGameAllocator(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unexpected error'),
    );
    warnSpy.mockRestore();
  });
});

// ============================================================================
// Malformed-JSONB failure modes
// ============================================================================

describe('loadPerGameAllocator — malformed JSONB', () => {
  it('returns null + warn when winner_side is missing the base field', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Broken',
        winner_side: { formula: null },
        loser_side: { base: 0, formula: null },
      },
      error: null,
    });
    const result = await loadPerGameAllocator(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('malformed JSONB'),
    );
    warnSpy.mockRestore();
  });

  it('returns null + warn when loser_side.base is a string', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Broken',
        winner_side: { base: 10, formula: null },
        loser_side: { base: 'seven', formula: null },
      },
      error: null,
    });
    const result = await loadPerGameAllocator(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('malformed JSONB'),
    );
    warnSpy.mockRestore();
  });

  it('returns null + warn when range base is missing min', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Broken',
        winner_side: { base: 10, formula: null },
        loser_side: { base: { max: 7, label: 'Balls' }, formula: null },
      },
      error: null,
    });
    const result = await loadPerGameAllocator(ID);
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('returns null + warn when formula.operationKind is not a string', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Broken',
        winner_side: { base: 10, formula: { operationKind: 42, operationArgs: {} } },
        loser_side: { base: 0, formula: null },
      },
      error: null,
    });
    const result = await loadPerGameAllocator(ID);
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });
});

// ============================================================================
// Validator failure modes
// ============================================================================

describe('loadPerGameAllocator — validator rejection', () => {
  it('returns null + warn when formula references an unregistered operation', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: ID,
        name: 'Broken',
        winner_side: {
          base: 10,
          formula: { operationKind: 'totally_made_up_op', operationArgs: {} },
        },
        loser_side: { base: 0, formula: null },
      },
      error: null,
    });
    const result = await loadPerGameAllocator(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('validation rejected'),
    );
    warnSpy.mockRestore();
  });
});

// ============================================================================
// Args-shape validation (Unit 3) — enable once the tightened validator lands
// ============================================================================

describe.skip('loadPerGameAllocator — args-shape (TODO Unit 3)', () => {
  it("rejects formula args with the wrong type (e.g. max: 'seven')", async () => {
    // Pending Unit 3's argsShape declarations on each AllocatorFormulaOperation
    // + the validator extension. Today the loader's validator only checks
    // operationKind resolves; args content is unchecked until then.
  });
});
