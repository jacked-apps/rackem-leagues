/**
 * @fileoverview Threshold row loader — DB row → in-memory threshold module.
 *
 * Unit 1 of the Threshold Workshop plan
 * (`docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md`).
 *
 * Reads one row from `thresholds`, rebuilds the resolvable `ThresholdRow` from
 * its stored `{ operationKind, operationArgs }` via `buildThresholdRow` (the
 * registry is the single source of truth for consumes/produces metadata — so
 * nothing can drift), and returns a `LoadedThreshold` wrapping that row plus
 * the workshop metadata (label, description, expansion mode). **Never throws.**
 * Any failure — row not found, malformed definition, unregistered operation,
 * supabase error — is logged via `console.warn` and surfaced as a `null`
 * return.
 *
 * Mirrors `trigger-loader.ts` / `per-game-allocator-loader.ts` in shape: the
 * second of the room's guard layers between a saved row and the runtime. It is
 * what makes "the runtime never sees an uncertified row" hold even when a row
 * was inserted via direct DB access bypassing the editor.
 *
 * Note: `buildThresholdRow` requires the named operation to be registered.
 * The threshold operations (`evaluate_expression`, `chart_lookup`, the existing
 * chart_lookup_3v3 / read_pref / …) register themselves at module load; a row
 * naming an unknown operation loads as `null`.
 */

import { supabase } from '@/supabaseClient';
import { fetchResolvedChart } from '@/api/queries/thresholdCharts';
import { buildThresholdRow } from './threshold-resolver';
import type { ThresholdExpansionMode, ThresholdRow } from './types';

// ============================================================================
// Public API
// ============================================================================

/**
 * A saved threshold loaded from the `thresholds` table: the resolvable
 * `ThresholdRow` (the state-setter primitive) plus the workshop metadata the
 * UI and the future assembly room need.
 */
export interface LoadedThreshold {
  /** `thresholds.id` — the table primary key. */
  readonly id: string;
  /** Human-facing display name (editable decoration). */
  readonly label: string;
  /** Optional LO-authored description. */
  readonly description: string | null;
  /** How this threshold fans out into state-bag values at resolve time. */
  readonly expansionMode: ThresholdExpansionMode;
  /** The resolvable threshold primitive (built from the registry). */
  readonly row: ThresholdRow;
}

const EXPANSION_MODES: readonly ThresholdExpansionMode[] = [
  'single',
  'home_away',
  'per_pairing',
];

/**
 * Load and validate a threshold row by id. Returns `null` on any failure
 * (row not found, bad definition, unregistered operation, supabase error).
 *
 * Never throws. All failure modes log a `console.warn` describing the row id
 * + reason so they are diagnosable without breaking the caller.
 *
 * @param id - The `thresholds.id` UUID to load.
 * @returns A validated `LoadedThreshold`, or `null`.
 */
export async function loadThreshold(id: string): Promise<LoadedThreshold | null> {
  let row: ThresholdTableRow;
  try {
    const { data, error } = await supabase
      .from('thresholds')
      .select('id, name, label, description, definition, expansion_mode')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn(`[loadThreshold] supabase error for id=${id}: ${error.message}`);
      return null;
    }
    if (!data) {
      console.warn(`[loadThreshold] no row found for id=${id}`);
      return null;
    }
    row = data as unknown as ThresholdTableRow;
  } catch (err) {
    console.warn(
      `[loadThreshold] unexpected error fetching id=${id}: ${stringifyError(err)}`,
    );
    return null;
  }

  let thresholdRow: ThresholdRow;
  let expansionMode: ThresholdExpansionMode;
  try {
    const { operationKind, operationArgs } = parseDefinition(row.definition, row.id);
    expansionMode = parseExpansionMode(row.expansion_mode, row.id);
    // Chart-view thresholds reference a chart by id; pull its rows in the same
    // load and embed them so the synchronous chart_lookup compute can read them
    // (the chart rides INSIDE the loaded threshold — one DB load).
    const enrichedArgs = await enrichChartArgs(operationKind, operationArgs, row.id);
    // buildThresholdRow re-derives consumes/produces metadata from the
    // registry and throws if the operation is unregistered — a row naming an
    // unknown operation surfaces here as `null`.
    thresholdRow = buildThresholdRow({
      name: row.name,
      operationKind,
      operationArgs: enrichedArgs,
    });
  } catch (err) {
    console.warn(
      `[loadThreshold] rejected id=${id} (label="${row.label}"): ${stringifyError(err)}`,
    );
    return null;
  }

  return {
    id: row.id,
    label: row.label,
    description: row.description ?? null,
    expansionMode,
    row: thresholdRow,
  };
}

// ============================================================================
// Row shape (matches the DB columns this loader needs)
// ============================================================================

interface ThresholdTableRow {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly description: string | null;
  readonly definition: unknown;
  readonly expansion_mode: unknown;
}

// ============================================================================
// JSONB → in-memory shapes
// ============================================================================

/**
 * Parse the stored `{ operationKind, operationArgs }` definition. Throws a
 * precise error on shape mismatch — caller catches and converts to `null`.
 */
function parseDefinition(
  raw: unknown,
  rowId: string,
): { operationKind: string; operationArgs: Record<string, unknown> } {
  if (!isObject(raw)) {
    throw new Error(`definition on row ${rowId} is not a JSON object`);
  }
  const { operationKind, operationArgs } = raw as Record<string, unknown>;
  if (typeof operationKind !== 'string' || operationKind.length === 0) {
    throw new Error(`definition.operationKind on row ${rowId} must be a non-empty string`);
  }
  if (!isObject(operationArgs)) {
    throw new Error(`definition.operationArgs on row ${rowId} must be a JSON object`);
  }
  return { operationKind, operationArgs: operationArgs as Record<string, unknown> };
}

/**
 * For chart-view thresholds (`operationKind === 'chart_lookup'`), fetch the
 * referenced chart and embed its resolved rows into the args so the sync
 * compute can read them. Other operations pass through untouched. Throws if a
 * referenced chart can't be loaded — caller converts that to a `null` return.
 */
async function enrichChartArgs(
  operationKind: string,
  operationArgs: Record<string, unknown>,
  rowId: string,
): Promise<Record<string, unknown>> {
  if (operationKind !== 'chart_lookup') return operationArgs;
  // User-owned thresholds embed their chart's rows inline (clone-to-own, like
  // the allocator embeds its config) — pass them straight through.
  const embedded = operationArgs.chart;
  if (embedded && typeof embedded === 'object' && Array.isArray((embedded as { rows?: unknown }).rows)) {
    return operationArgs;
  }
  // Otherwise the threshold references a shared chart by id — fetch + embed.
  const chartId = operationArgs.chart_id;
  if (typeof chartId !== 'string' || chartId.length === 0) {
    throw new Error(`chart_lookup threshold on row ${rowId} has neither an embedded chart nor a chart_id`);
  }
  const chart = await fetchResolvedChart(chartId);
  if (!chart) {
    throw new Error(`chart_lookup threshold on row ${rowId} references unloadable chart ${chartId}`);
  }
  return { ...operationArgs, chart };
}

function parseExpansionMode(raw: unknown, rowId: string): ThresholdExpansionMode {
  if (typeof raw === 'string' && (EXPANSION_MODES as readonly string[]).includes(raw)) {
    return raw as ThresholdExpansionMode;
  }
  throw new Error(
    `expansion_mode on row ${rowId} must be one of ${EXPANSION_MODES.join(', ')}`,
  );
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
