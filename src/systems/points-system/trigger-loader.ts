/**
 * @fileoverview Trigger loader — DB row → in-memory Trigger.
 *
 * Unit 2 of the Trigger Room plan
 * (`docs/plans/2026-06-06-001-feat-trigger-room-plan.md`).
 *
 * Reads one row from `triggers`, unmarshals its JSONB into the in-memory
 * `Trigger` shape, validates the result, and returns either a usable
 * trigger object or `null`. **Never throws.** Any failure — row not
 * found, malformed JSONB, validator rejection, supabase error — is
 * logged via `console.warn` and surfaced as a `null` return.
 *
 * Order is NOT stored in the DB (per the brainstorm: it's a scoring
 * system room concern). The loader synthesizes a default
 * `{ number: 0, beforeAllocator: false }` on every load. The future
 * scoring system room overrides this when assembling the trigger into
 * a composition.
 *
 * Mirrors `per-game-allocator-loader.ts` in shape. The two loaders are
 * independent — separate functions, separate validations, separate
 * tables. They share only the never-throw discipline.
 */

import { supabase } from '@/supabaseClient';
import { validateTrigger } from './composition-validator';
import type {
  Condition,
  Expression,
  MatchStateValue,
  Trigger,
  TriggerAction,
  TriggerType,
} from './types';

const ALLOWED_TARGETS = ['home_points', 'away_points'] as const;

/**
 * Load and validate a trigger row by id. Returns `null` on any failure.
 * Never throws.
 */
export async function loadTrigger(id: string): Promise<Trigger | null> {
  let row: TriggerRow;
  try {
    const { data, error } = await supabase
      .from('triggers')
      .select('id, name, trigger_type, condition, action, rearm')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn(
        `[loadTrigger] supabase error for id=${id}: ${error.message}`,
      );
      return null;
    }
    if (!data) {
      console.warn(`[loadTrigger] no row found for id=${id}`);
      return null;
    }
    row = data as unknown as TriggerRow;
  } catch (err) {
    console.warn(
      `[loadTrigger] unexpected error fetching id=${id}: ${stringifyError(err)}`,
    );
    return null;
  }

  let trigger: Trigger;
  try {
    const condition = parseCondition(row.condition, row.id);
    const action = parseAction(row.action, row.id);
    trigger = {
      name: row.name,
      type: row.trigger_type as TriggerType,
      condition,
      action,
      rearm: row.rearm as Trigger['rearm'],
      // Order defaults at load time; the future scoring system room
      // overrides this when assembling the trigger into a composition.
      order: { number: 0, beforeAllocator: false },
    };
  } catch (err) {
    console.warn(
      `[loadTrigger] malformed JSONB for id=${id}: ${stringifyError(err)}`,
    );
    return null;
  }

  try {
    validateTrigger(trigger, { allowedTargets: ALLOWED_TARGETS });
  } catch (err) {
    console.warn(
      `[loadTrigger] validation rejected id=${id} (name="${row.name}"): ${stringifyError(err)}`,
    );
    return null;
  }

  return trigger;
}

// ============================================================================
// Row shape
// ============================================================================

interface TriggerRow {
  readonly id: string;
  readonly name: string;
  readonly trigger_type: string;
  readonly condition: unknown;
  readonly action: unknown;
  readonly rearm: string;
}

// ============================================================================
// JSONB → in-memory shapes
// ============================================================================

function parseCondition(raw: unknown, rowId: string): Condition {
  if (!isObject(raw)) {
    throw new Error(`condition on row ${rowId} is not a JSON object`);
  }
  if (raw.kind === 'always') {
    return { kind: 'always' };
  }
  if (raw.kind === 'compare') {
    const left = parseConditionOperand(raw.left, rowId, 'condition.left');
    const right = parseConditionOperand(raw.right, rowId, 'condition.right');
    const op = raw.op;
    if (
      op !== '==' &&
      op !== '>' &&
      op !== '<' &&
      op !== '>=' &&
      op !== '<='
    ) {
      throw new Error(
        `condition.op on row ${rowId} must be one of ==, >, <, >=, <=`,
      );
    }
    return { kind: 'compare', left, op, right };
  }
  throw new Error(`condition.kind on row ${rowId} must be 'always' or 'compare'`);
}

function parseConditionOperand(
  raw: unknown,
  rowId: string,
  fieldName: string,
): { kind: 'const'; value: number } | { kind: 'var'; name: string } {
  if (!isObject(raw)) {
    throw new Error(`${fieldName} on row ${rowId} is not a JSON object`);
  }
  if (raw.kind === 'const' && typeof raw.value === 'number' && Number.isFinite(raw.value)) {
    return { kind: 'const', value: raw.value };
  }
  if (raw.kind === 'var' && typeof raw.name === 'string' && raw.name.length > 0) {
    return { kind: 'var', name: raw.name };
  }
  throw new Error(
    `${fieldName} on row ${rowId} must be { kind: 'const', value: number } or { kind: 'var', name: string }`,
  );
}

function parseAction(raw: unknown, rowId: string): TriggerAction {
  if (!isObject(raw)) {
    throw new Error(`action on row ${rowId} is not a JSON object`);
  }
  if (typeof raw.target !== 'string' || raw.target.length === 0) {
    throw new Error(`action.target on row ${rowId} must be a non-empty string`);
  }
  if (!isObject(raw.value)) {
    throw new Error(`action.value on row ${rowId} must be a JSON object`);
  }
  const v = raw.value as Record<string, unknown>;
  if (v.kind === 'set') {
    return { target: raw.target, value: { kind: 'set', value: v.value as MatchStateValue } };
  }
  if (v.kind === 'expr') {
    const expr = parseExpression(v.expr, rowId);
    return { target: raw.target, value: { kind: 'expr', expr } };
  }
  throw new Error(`action.value.kind on row ${rowId} must be 'set' or 'expr'`);
}

function parseExpression(raw: unknown, rowId: string): Expression {
  if (!isObject(raw)) {
    throw new Error(`expression on row ${rowId} is not a JSON object`);
  }
  if (raw.kind === 'const' && typeof raw.value === 'number' && Number.isFinite(raw.value)) {
    return { kind: 'const', value: raw.value };
  }
  if (raw.kind === 'var' && typeof raw.name === 'string' && raw.name.length > 0) {
    return { kind: 'var', name: raw.name };
  }
  if (raw.kind === 'op') {
    const op = raw.op;
    if (op !== '+' && op !== '-' && op !== '*' && op !== '/') {
      throw new Error(`expression.op on row ${rowId} must be +, -, *, or /`);
    }
    return {
      kind: 'op',
      op,
      left: parseExpression(raw.left, rowId),
      right: parseExpression(raw.right, rowId),
    };
  }
  throw new Error(`expression.kind on row ${rowId} must be 'const', 'var', or 'op'`);
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
