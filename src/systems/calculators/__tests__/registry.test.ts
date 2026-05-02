/**
 * @fileoverview Smoke tests for the points-calculator registry skeleton
 * (Phase 1 Unit 1.1 of the modular-league-system v2 plan).
 *
 * Validates the contract before any calculator implementations land:
 *   - registry exports compile and behave as an empty store
 *   - getCalculator returns null for unknown / null / undefined names
 *   - registerCalculator + getCalculator round-trip works (using a minimal
 *     fixture; the real calculators land in Units 1.2–1.4)
 *   - Duplicate registration throws (catches bugs from accidental double-registration)
 *   - The discriminated union narrows correctly: an aggregate calculator's
 *     compute signature accepts AggregateInput, a per-game calculator's
 *     accepts PerGameInput, and TypeScript enforces the distinction
 *
 * No real calculators are exercised here — those have their own tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  getCalculator,
  registerCalculator,
  listCalculators,
  clearRegistry,
  type AggregatePointsCalculator,
  type PerGamePointsCalculator,
} from '../index';

// ============================================================================
// Fixtures: minimal calculators just to exercise the registry's contract
// ============================================================================

/** A trivial aggregate calculator that returns 0 — tests the registry shape. */
const stubAggregateCalculator: AggregatePointsCalculator<{ multiplier: number }> = {
  name: 'stub_aggregate',
  kind: 'aggregate',
  defaultParams: { multiplier: 1 },
  paramSchema: z.object({ multiplier: z.number() }),
  scoringPopupFields: () => ({ perSideInputs: null }),
  compute: () => 0,
};

/** A trivial per-game calculator that returns 0 — tests the registry shape. */
const stubPerGameCalculator: PerGamePointsCalculator<{ winnerPoints: number }> = {
  name: 'stub_per_game',
  kind: 'per_game',
  defaultParams: { winnerPoints: 10 },
  paramSchema: z.object({ winnerPoints: z.number() }),
  scoringPopupFields: (params) => ({
    perSideInputs: {
      winner: { kind: 'fixed', points: params.winnerPoints },
      loser: { kind: 'counter', min: 0, max: 7, label: 'Balls pocketed' },
    },
  }),
  compute: () => 0,
};

// ============================================================================
// Tests
// ============================================================================

describe('points-calculator registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe('empty registry behavior', () => {
    it('getCalculator returns null when registry is empty', () => {
      expect(getCalculator('any_name')).toBeNull();
    });

    it('listCalculators returns an empty array when registry is empty', () => {
      expect(listCalculators()).toEqual([]);
    });
  });

  describe('lookup by name', () => {
    it('returns null for an unknown name', () => {
      registerCalculator(stubAggregateCalculator);
      expect(getCalculator('totally_unknown_calculator')).toBeNull();
    });

    it('returns null for null input', () => {
      registerCalculator(stubAggregateCalculator);
      expect(getCalculator(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      registerCalculator(stubAggregateCalculator);
      expect(getCalculator(undefined)).toBeNull();
    });

    it('returns the registered calculator for a known name', () => {
      registerCalculator(stubAggregateCalculator);
      const found = getCalculator('stub_aggregate');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('stub_aggregate');
      expect(found?.kind).toBe('aggregate');
    });
  });

  describe('registration', () => {
    it('round-trips an aggregate calculator', () => {
      registerCalculator(stubAggregateCalculator);
      const found = getCalculator('stub_aggregate');
      expect(found).toBe(stubAggregateCalculator);
    });

    it('round-trips a per-game calculator', () => {
      registerCalculator(stubPerGameCalculator);
      const found = getCalculator('stub_per_game');
      expect(found).toBe(stubPerGameCalculator);
    });

    it('registers multiple calculators independently', () => {
      registerCalculator(stubAggregateCalculator);
      registerCalculator(stubPerGameCalculator);
      expect(listCalculators()).toEqual(
        expect.arrayContaining(['stub_aggregate', 'stub_per_game']),
      );
      expect(listCalculators().length).toBe(2);
    });

    it('throws on duplicate registration', () => {
      registerCalculator(stubAggregateCalculator);
      expect(() => registerCalculator(stubAggregateCalculator)).toThrow(
        /Duplicate registration/,
      );
    });
  });

  describe('discriminated union narrowing', () => {
    it("aggregate calculator's compute is callable with AggregateInput", () => {
      registerCalculator(stubAggregateCalculator);
      const calc = getCalculator('stub_aggregate');
      expect(calc).not.toBeNull();
      // Type narrowing via `kind`. TypeScript enforces this at compile-time;
      // runtime check confirms the kind value is what we expect.
      if (calc?.kind === 'aggregate') {
        const result = calc.compute(
          {
            gamesWon: 10,
            thresholds: { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 },
          },
          { multiplier: 1 },
        );
        expect(result).toBe(0); // stub always returns 0
      }
    });

    it("per-game calculator's compute is callable with PerGameInput", () => {
      registerCalculator(stubPerGameCalculator);
      const calc = getCalculator('stub_per_game');
      expect(calc).not.toBeNull();
      if (calc?.kind === 'per_game') {
        const result = calc.compute(
          { games: [], teamId: 'team-a' },
          { winnerPoints: 10 },
        );
        expect(result).toBe(0); // stub always returns 0
      }
    });
  });

  describe('scoringPopupFields', () => {
    it('aggregate calculator declares perSideInputs: null', () => {
      registerCalculator(stubAggregateCalculator);
      const calc = getCalculator('stub_aggregate');
      const spec = calc?.scoringPopupFields({ multiplier: 1 });
      expect(spec?.perSideInputs).toBeNull();
    });

    it('per-game calculator declares per-side counter / fixed config', () => {
      registerCalculator(stubPerGameCalculator);
      const calc = getCalculator('stub_per_game');
      const spec = calc?.scoringPopupFields({ winnerPoints: 10 });
      expect(spec?.perSideInputs).not.toBeNull();
      expect(spec?.perSideInputs?.winner).toEqual({ kind: 'fixed', points: 10 });
      expect(spec?.perSideInputs?.loser).toEqual({
        kind: 'counter',
        min: 0,
        max: 7,
        label: 'Balls pocketed',
      });
    });

    it('per-game spec adapts to params (LO-edited values flow through)', () => {
      registerCalculator(stubPerGameCalculator);
      const calc = getCalculator('stub_per_game');
      const spec = calc?.scoringPopupFields({ winnerPoints: 15 });
      expect(spec?.perSideInputs?.winner).toEqual({ kind: 'fixed', points: 15 });
    });
  });

  describe('paramSchema', () => {
    it('aggregate calculator schema validates valid params', () => {
      const result = stubAggregateCalculator.paramSchema.safeParse({ multiplier: 2 });
      expect(result.success).toBe(true);
    });

    it('aggregate calculator schema rejects invalid params', () => {
      const result = stubAggregateCalculator.paramSchema.safeParse({
        multiplier: 'not a number',
      });
      expect(result.success).toBe(false);
    });

    it('per-game calculator schema validates valid params', () => {
      const result = stubPerGameCalculator.paramSchema.safeParse({ winnerPoints: 10 });
      expect(result.success).toBe(true);
    });
  });
});
