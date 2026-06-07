/**
 * @fileoverview Per-Game Allocator loader — DB row → in-memory PerGameAllocator.
 *
 * Unit 2 of the Per-Game Allocator Room plan
 * (`docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md`).
 *
 * Reads one row from `per_game_allocators`, unmarshals its JSONB sides into
 * the in-memory `PerGameAllocator` shape, validates the result, and returns
 * either a usable allocator object or `null`. **Never throws.** Any failure —
 * row not found, malformed JSONB, validator rejection, supabase error —
 * is logged via `console.warn` and surfaced as a `null` return. Callers
 * (e.g. the live-scoring path's snapshot writer) treat `null` as "no
 * variation; fall back to prepackaged composition" — the same shape as
 * "no FK was set at all."
 *
 * This is the data-to-object bridge for the workshop:
 *
 *   workshop UI (Unit 6) → table row → loader (this file) → runtime
 *
 * The loader is also the second of four guard layers between a saved row
 * and the runtime (the others being the editor's save-time guard,
 * the snapshot freeze, and the runtime safety net wrapping the allocator
 * call). It is what makes the contract "the runtime never sees an
 * uncertified row" hold even when a row was inserted via direct DB access
 * bypassing the editor.
 */

import { supabase } from '@/supabaseClient';
import { validatePerGameAllocator } from './composition-validator';
import type {
  AllocatorFormulaRef,
  PerGameAllocator,
  SideConfig,
  SideInputRange,
} from './types';

// ============================================================================
// Public API
// ============================================================================

/**
 * Load and validate a per-game allocator row by id. Returns `null` on any
 * failure (row not found, bad JSONB, validator rejection, supabase error).
 *
 * Never throws. All failure modes log a `console.warn` describing the row
 * id + reason so they are diagnosable without breaking the caller.
 *
 * @param id - The `per_game_allocators.id` UUID to load.
 * @returns A validated `PerGameAllocator` ready for the runtime, or `null`.
 */
export async function loadPerGameAllocator(
  id: string,
): Promise<PerGameAllocator | null> {
  let row: PerGameAllocatorRow;
  try {
    const { data, error } = await supabase
      .from('per_game_allocators')
      .select('id, name, winner_side, loser_side')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn(
        `[loadPerGameAllocator] supabase error for id=${id}: ${error.message}`,
      );
      return null;
    }
    if (!data) {
      console.warn(`[loadPerGameAllocator] no row found for id=${id}`);
      return null;
    }
    row = data as unknown as PerGameAllocatorRow;
  } catch (err) {
    console.warn(
      `[loadPerGameAllocator] unexpected error fetching id=${id}: ${stringifyError(err)}`,
    );
    return null;
  }

  let allocator: PerGameAllocator;
  try {
    const winner = parseSide(row.winner_side, row.id, 'winner');
    const loser = parseSide(row.loser_side, row.id, 'loser');
    allocator = { name: row.name, winner, loser };
  } catch (err) {
    console.warn(
      `[loadPerGameAllocator] malformed JSONB for id=${id}: ${stringifyError(err)}`,
    );
    return null;
  }

  try {
    validatePerGameAllocator(allocator);
  } catch (err) {
    console.warn(
      `[loadPerGameAllocator] validation rejected id=${id} (name="${row.name}"): ${stringifyError(err)}`,
    );
    return null;
  }

  return allocator;
}

// ============================================================================
// Row shape (matches the DB columns this loader needs)
// ============================================================================

interface PerGameAllocatorRow {
  readonly id: string;
  readonly name: string;
  readonly winner_side: unknown;
  readonly loser_side: unknown;
}

// ============================================================================
// JSONB → SideConfig
// ============================================================================

/**
 * Parse a JSONB side blob into an in-memory `SideConfig`. Throws a precise
 * error on shape mismatch — caller catches and converts to a `null` return.
 *
 * Expected shape:
 *   { base: number | { min, max, label }, formula: null | { operationKind, operationArgs } }
 */
function parseSide(
  raw: unknown,
  rowId: string,
  sideName: 'winner' | 'loser',
): SideConfig {
  if (!isObject(raw)) {
    throw new Error(
      `${sideName}_side on row ${rowId} is not a JSON object`,
    );
  }
  if (!('base' in raw)) {
    throw new Error(
      `${sideName}_side on row ${rowId} is missing the 'base' field`,
    );
  }
  if (!('formula' in raw)) {
    throw new Error(
      `${sideName}_side on row ${rowId} is missing the 'formula' field`,
    );
  }

  const base = parseBase(raw.base, rowId, sideName);
  const formula = parseFormula(raw.formula, rowId, sideName);
  return { base, formula };
}

function parseBase(
  raw: unknown,
  rowId: string,
  sideName: 'winner' | 'loser',
): number | SideInputRange {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (isObject(raw)) {
    const { min, max, label } = raw as Record<string, unknown>;
    if (
      typeof min === 'number' &&
      Number.isFinite(min) &&
      typeof max === 'number' &&
      Number.isFinite(max) &&
      typeof label === 'string'
    ) {
      return { min, max, label };
    }
  }
  throw new Error(
    `${sideName}_side.base on row ${rowId} must be a finite number or { min, max, label } range`,
  );
}

function parseFormula(
  raw: unknown,
  rowId: string,
  sideName: 'winner' | 'loser',
): AllocatorFormulaRef | null {
  if (raw === null) return null;
  if (!isObject(raw)) {
    throw new Error(
      `${sideName}_side.formula on row ${rowId} must be null or an object`,
    );
  }
  const { operationKind, operationArgs } = raw as Record<string, unknown>;
  if (typeof operationKind !== 'string') {
    throw new Error(
      `${sideName}_side.formula.operationKind on row ${rowId} must be a string`,
    );
  }
  if (!isObject(operationArgs)) {
    throw new Error(
      `${sideName}_side.formula.operationArgs on row ${rowId} must be an object`,
    );
  }
  return {
    operationKind,
    operationArgs: operationArgs as Record<string, unknown>,
  };
}

// ============================================================================
// Tiny helpers
// ============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
