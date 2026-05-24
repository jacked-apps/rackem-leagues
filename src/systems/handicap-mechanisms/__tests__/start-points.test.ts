/**
 * @fileoverview Tests for the Start Points Mechanism factory.
 *
 * @see ../start-points.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { createStartPointsMechanism } from '../start-points';
import { fargoFormulaChart } from '../../threshold-charts';

const NO_OVERRIDES = {};

describe('createStartPointsMechanism — factory wires Fargo Formula Chart through', () => {
  it('returns a Mechanism with kind="start_points"', () => {
    const mech = createStartPointsMechanism(fargoFormulaChart);
    expect(mech.kind).toBe('start_points');
  });

  it('compute delegates to the bound Chart with all three args', () => {
    const mech = createStartPointsMechanism(fargoFormulaChart);
    const home = [567, 458, 493, 486, 574];
    const away = [447, 394, 452, 322, 374];
    expect(mech.compute(home, away, NO_OVERRIDES)).toEqual(
      fargoFormulaChart.compute(home, away, NO_OVERRIDES),
    );
  });

  it('preserves the validated real-match anchor case', () => {
    // Anchor: 117-point gap → 56 start points to the weaker (away) team.
    const mech = createStartPointsMechanism(fargoFormulaChart);
    const result = mech.compute(
      [567, 458, 493, 486, 574],
      [447, 394, 452, 322, 374],
      NO_OVERRIDES,
    );
    expect(result.startPointsForWeakerTeam).toBe(56);
    expect(result.weakerTeam).toBe('away');
  });

  it('honors overrides through the Chart (e.g., winner_points)', () => {
    const mech = createStartPointsMechanism(fargoFormulaChart);
    const baseline = mech.compute(
      [600, 600, 600, 600, 600],
      [400, 400, 400, 400, 400],
      NO_OVERRIDES,
    );
    const overridden = mech.compute(
      [600, 600, 600, 600, 600],
      [400, 400, 400, 400, 400],
      { winner_points: 20 },
    );
    expect(overridden.startPointsForWeakerTeam).toBeGreaterThan(
      baseline.startPointsForWeakerTeam,
    );
  });
});
