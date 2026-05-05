/**
 * @fileoverview Contract tests for the points-calculator type system,
 * specifically the `displayHints` extension added in Unit 1 of the
 * unified-scoreboard plan (`docs/plans/2026-05-03-001-feat-unified-scoreboard-plan.md`).
 *
 * The change is purely additive — the new `displayHints` field on
 * `CalculatorBase<P>` is optional, and calculators may declare per-param
 * hints (schema-derived) OR provide a `getDisplayHints` escape hatch for
 * structural cases that don't fit the per-key shape.
 *
 * These tests are constructed to fail at compile time if the contract
 * regresses — the runtime assertions confirm the values are real, but the
 * principal verification is "this file type-checks against the contract."
 *
 * Test scenarios (per Unit 1):
 *   - Calculator with `displayHints` on every param compiles and `keyof P`
 *     narrows correctly.
 *   - Calculator with NO `displayHints` field still satisfies
 *     `CalculatorBase<P>` (optional).
 *   - Calculator with `displayHints` for some params but not others is
 *     allowed (Partial<...>-equivalent shape).
 *   - Unknown `role` string passes type-checking (open enum verified).
 *   - Calculator with `getDisplayHints` escape hatch returning DisplayHints
 *     compiles (the canonical path for `accumulated_per_game`).
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type {
  AggregatePointsCalculator,
  PerGamePointsCalculator,
  ParamDisplayHint,
  DisplayHint,
} from '../types';

// ============================================================================
// Scenario 1: displayHints declared on every param
// ============================================================================

interface FullHintParams {
  milestone_pct: number;
  multiplier: number;
}

const calculatorWithFullHints: AggregatePointsCalculator<FullHintParams> = {
  name: 'stub_full_hints',
  kind: 'aggregate',
  defaultParams: { milestone_pct: 0.7, multiplier: 1.5 },
  paramSchema: z.object({
    milestone_pct: z.number(),
    multiplier: z.number(),
  }),
  scoringPopupFields: () => ({ perSideInputs: null }),
  compute: () => 0,
  // Every param has a hint — the canonical schema-derived case.
  displayHints: {
    milestone_pct: { role: 'milestone', label: 'Bonus at' },
    multiplier: { role: 'progress_target', label: 'Multiplier' },
  },
};

// ============================================================================
// Scenario 2: NO displayHints field — optional contract
// ============================================================================

interface NoHintParams {
  threshold: number;
}

const calculatorWithoutHints: AggregatePointsCalculator<NoHintParams> = {
  name: 'stub_no_hints',
  kind: 'aggregate',
  defaultParams: { threshold: 5 },
  paramSchema: z.object({ threshold: z.number() }),
  scoringPopupFields: () => ({ perSideInputs: null }),
  compute: () => 0,
  // No displayHints, no getDisplayHints — type system must allow this.
};

// ============================================================================
// Scenario 3: displayHints declared for SOME params (partial coverage)
// ============================================================================

interface PartialHintParams {
  cared_about: number;
  not_cared_about: number;
  also_skipped: number;
}

const calculatorWithPartialHints: AggregatePointsCalculator<PartialHintParams> = {
  name: 'stub_partial_hints',
  kind: 'aggregate',
  defaultParams: { cared_about: 1, not_cared_about: 2, also_skipped: 3 },
  paramSchema: z.object({
    cared_about: z.number(),
    not_cared_about: z.number(),
    also_skipped: z.number(),
  }),
  scoringPopupFields: () => ({ perSideInputs: null }),
  compute: () => 0,
  // Only one param has a hint — the others are silent (no rendering).
  displayHints: {
    cared_about: { role: 'milestone' },
  },
};

// ============================================================================
// Scenario 4: Unknown role string (open enum verified)
// ============================================================================

interface OpenEnumParams {
  exotic: number;
}

const calculatorWithUnknownRole: AggregatePointsCalculator<OpenEnumParams> = {
  name: 'stub_open_enum',
  kind: 'aggregate',
  defaultParams: { exotic: 42 },
  paramSchema: z.object({ exotic: z.number() }),
  scoringPopupFields: () => ({ perSideInputs: null }),
  compute: () => 0,
  // 'novel_marker_type' is NOT one of the documented known roles, but the
  // open-enum string type accepts it. The scoreboard's runtime falls back
  // to generic rendering.
  displayHints: {
    exotic: { role: 'novel_marker_type', label: 'Exotic value' },
  },
};

// ============================================================================
// Scenario 5: getDisplayHints escape hatch (canonical for structural keys)
// ============================================================================

// Mirrors accumulated_per_game's per-side shape — keyof P is 'winner'/'loser',
// not per-field. The schema-derived `displayHints` doesn't fit; the escape
// hatch is the right tool.
interface PerSideStructuralParams {
  winner: { kind: 'fixed'; points: number };
  loser: { kind: 'counter'; max: number };
}

const calculatorWithEscapeHatch: PerGamePointsCalculator<PerSideStructuralParams> = {
  name: 'stub_escape_hatch',
  kind: 'per_game',
  defaultParams: {
    winner: { kind: 'fixed', points: 10 },
    loser: { kind: 'counter', max: 7 },
  },
  paramSchema: z.object({
    winner: z.object({ kind: z.literal('fixed'), points: z.number() }),
    loser: z.object({ kind: z.literal('counter'), max: z.number() }),
  }),
  scoringPopupFields: () => ({ perSideInputs: null }),
  compute: () => 0,
  // getDisplayHints emits runtime DisplayHint objects with computed labels.
  // No `displayHints` field — the escape hatch is the only display path.
  getDisplayHints: (params) => [
    {
      role: 'progress_target',
      label: 'Winner gets',
      value: params.winner.kind === 'fixed' ? params.winner.points : 0,
    },
  ],
};

// ============================================================================
// Runtime assertions — confirm the values exist and the imported types
// resolve. The principal contract verification is compile-time (the file
// type-checks); runtime tests just guard against the imports going stale.
// ============================================================================

describe('CalculatorBase displayHints contract', () => {
  it('accepts a calculator with displayHints declared on every param', () => {
    expect(calculatorWithFullHints.displayHints).toBeDefined();
    expect(calculatorWithFullHints.displayHints?.milestone_pct?.role).toBe('milestone');
    expect(calculatorWithFullHints.displayHints?.multiplier?.role).toBe('progress_target');
  });

  it('accepts a calculator with NO displayHints field (optional contract)', () => {
    expect(calculatorWithoutHints.displayHints).toBeUndefined();
    expect(calculatorWithoutHints.getDisplayHints).toBeUndefined();
  });

  it('accepts a calculator with displayHints for some params but not others', () => {
    expect(calculatorWithPartialHints.displayHints?.cared_about?.role).toBe('milestone');
    // Untouched params are absent from the hints record.
    expect(calculatorWithPartialHints.displayHints?.not_cared_about).toBeUndefined();
    expect(calculatorWithPartialHints.displayHints?.also_skipped).toBeUndefined();
  });

  it('accepts an unknown role string (open enum behavior)', () => {
    const hint: ParamDisplayHint | undefined =
      calculatorWithUnknownRole.displayHints?.exotic;
    expect(hint?.role).toBe('novel_marker_type');
    // Type-system note: `role: string` admits any string at compile time.
    // Runtime renderers must treat unknown roles as the generic fallback.
  });

  it('accepts a calculator using the getDisplayHints escape hatch', () => {
    expect(calculatorWithEscapeHatch.getDisplayHints).toBeDefined();
    expect(calculatorWithEscapeHatch.displayHints).toBeUndefined();

    const hints: DisplayHint[] = calculatorWithEscapeHatch.getDisplayHints!(
      calculatorWithEscapeHatch.defaultParams,
    );
    expect(hints).toHaveLength(1);
    expect(hints[0].role).toBe('progress_target');
    expect(hints[0].value).toBe(10);
  });
});
