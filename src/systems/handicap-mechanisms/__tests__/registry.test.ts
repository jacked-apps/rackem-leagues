/**
 * @fileoverview Tests for the Handicap Mechanisms registry (buildHandicapMechanism).
 *
 * Verifies the dispatcher routes each mechanism kind to the correct factory
 * and that the returned instance carries the matching kind discriminator.
 *
 * @see ../index.ts — function under test
 */

import { describe, it, expect } from 'vitest';
import { buildHandicapMechanism } from '../index';
import {
  gamesNeeded3v3Chart,
  fargoFormulaChart,
  racePointsChart,
} from '../../threshold-charts';

describe('buildHandicapMechanism — dispatch by mechanismKind', () => {
  it('routes "extra_games" + a Games-Needed Chart to an ExtraGamesMechanism', () => {
    const mech = buildHandicapMechanism('extra_games', gamesNeeded3v3Chart);
    expect(mech.kind).toBe('extra_games');
  });

  it('routes "start_points" + the Fargo Formula Chart to a StartPointsMechanism', () => {
    const mech = buildHandicapMechanism('start_points', fargoFormulaChart);
    expect(mech.kind).toBe('start_points');
  });

  it('routes "race_length_adjustment" + a Race Chart to a RaceLengthAdjustmentMechanism', () => {
    const mech = buildHandicapMechanism(
      'race_length_adjustment',
      racePointsChart,
    );
    expect(mech.kind).toBe('race_length_adjustment');
  });
});
