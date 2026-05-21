/**
 * @fileoverview Trigger ACTION expression evaluator.
 *
 * A trigger's ACTION writes ONE state variable via a flat arithmetic expression
 * over state variables and constants (the locked Trigger model, `trigger.md`).
 * This file defines that expression as serializable data (a small tree) and the
 * pure function that computes it against the match-state bag.
 *
 * **Why a tree, not a string:** the expression is stored as structured data so a
 * future LO-facing builder UI can construct it from dropdowns with no string
 * parsing, and the engine can evaluate it directly. Parentheses are implicit in
 * the nesting — an `op` node's operands are themselves expressions.
 *
 * **NEVER-BREAK CONTRACT (load-bearing).** The live scoring engine must never
 * crash mid-match — games won/lost is the sacred metric and must keep recording
 * even when scoring math is misconfigured. So this evaluator does NOT throw on
 * bad math. Instead it returns a typed result: `{ ok: true, value }` on success,
 * or `{ ok: false, reason }` on any problem (divide-by-zero, a missing or
 * non-numeric variable). The caller logs the reason and SKIPS that one
 * calculation (leaving the affected value untouched) — points may end up wrong
 * (recoverable by hand), but scoring never breaks. Bad math is guarded primarily
 * in the workshop/builder; this is the runtime backstop.
 *
 * @see ./types.ts — MatchStateBag
 * @see docs/league-system/modules/points-system/trigger.md — the ACTION contract
 */

import type { MatchStateBag } from './types';

/**
 * A flat arithmetic expression, stored as serializable data (a tree).
 *
 * - `const` — a literal number (e.g., `1.5`, `0`).
 * - `var` — reads a named value off the state bag (e.g., `home_wins`, `winTarget`).
 * - `op` — a binary operation; operands are themselves expressions, so nesting
 *   expresses parentheses (e.g., `(home_wins − winTarget) × multiplier`).
 */
export type Expression =
  | { readonly kind: 'const'; readonly value: number }
  | { readonly kind: 'var'; readonly name: string }
  | {
      readonly kind: 'op';
      readonly op: '+' | '-' | '*' | '/';
      readonly left: Expression;
      readonly right: Expression;
    };

/**
 * Result of evaluating an expression. Never throws — a problem is reported as
 * `{ ok: false, reason }` so the caller can log it and skip the calculation
 * rather than crash live scoring.
 */
export type ExpressionResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: string };

/**
 * Internal recursive evaluation. Throws on bad math; the public
 * `evaluateExpression` wraps this and converts any throw into a safe
 * `{ ok: false, reason }`. Keeping the recursion throw-based keeps it simple;
 * the never-break boundary lives at the public function.
 */
function evalNode(expr: Expression, state: Readonly<MatchStateBag>): number {
  switch (expr.kind) {
    case 'const':
      return expr.value;

    case 'var': {
      const v = state[expr.name];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error(
          `state variable "${expr.name}" is not a finite number (got ${JSON.stringify(v)})`,
        );
      }
      return v;
    }

    case 'op': {
      const left = evalNode(expr.left, state);
      const right = evalNode(expr.right, state);
      switch (expr.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          if (right === 0) {
            throw new Error('divide-by-zero (a trigger expression divided by 0)');
          }
          return left / right;
      }
    }
  }
}

/**
 * Evaluate an expression against the match-state bag. **Never throws.**
 *
 * @param expr  The expression tree.
 * @param state The match-state bag (read-only — expressions never mutate state).
 * @returns `{ ok: true, value }` on success, or `{ ok: false, reason }` if the
 *   expression references a missing/non-numeric variable or divides by zero. The
 *   caller logs the reason and skips applying the result (never crashes scoring).
 */
export function evaluateExpression(
  expr: Expression,
  state: Readonly<MatchStateBag>,
): ExpressionResult {
  try {
    const value = evalNode(expr, state);
    // Defense-in-depth: a non-finite result must never escape into match state.
    if (!Number.isFinite(value)) {
      return { ok: false, reason: `expression produced a non-finite result (${value})` };
    }
    return { ok: true, value };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
