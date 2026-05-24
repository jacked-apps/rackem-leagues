/**
 * @fileoverview Tests for the Race Length Adjustment Mechanism factory (RESERVED).
 *
 * Both shipping Race Length Charts are RESERVED stubs, so the Mechanism
 * factory produces an instance whose compute will throw — confirming the
 * RESERVED contract bubbles up correctly.
 *
 * @see ../race-length-adjustment.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { createRaceLengthAdjustmentMechanism } from '../race-length-adjustment';
import { racePointsChart, racePercentageChart } from '../../threshold-charts';

const NO_OVERRIDES = {};

describe('createRaceLengthAdjustmentMechanism — factory wires Race Length Chart through (RESERVED)', () => {
  it('returns a Mechanism with kind="race_length_adjustment"', () => {
    const mech = createRaceLengthAdjustmentMechanism(racePointsChart);
    expect(mech.kind).toBe('race_length_adjustment');
  });

  it('compute throws RESERVED when bound to racePointsChart (stub bubbles up)', () => {
    const mech = createRaceLengthAdjustmentMechanism(racePointsChart);
    expect(() => mech.compute([2], [-1], NO_OVERRIDES)).toThrow(/RESERVED/);
  });

  it('compute throws RESERVED when bound to racePercentageChart (stub bubbles up)', () => {
    const mech = createRaceLengthAdjustmentMechanism(racePercentageChart);
    expect(() => mech.compute([50], [30], NO_OVERRIDES)).toThrow(/RESERVED/);
  });

  it('compute throws clearly on empty home ratings (input guard)', () => {
    const mech = createRaceLengthAdjustmentMechanism(racePointsChart);
    expect(() => mech.compute([], [1], NO_OVERRIDES)).toThrow(/non-empty/);
  });

  it('compute throws clearly on empty away ratings (input guard)', () => {
    const mech = createRaceLengthAdjustmentMechanism(racePointsChart);
    expect(() => mech.compute([1], [], NO_OVERRIDES)).toThrow(/non-empty/);
  });
});
