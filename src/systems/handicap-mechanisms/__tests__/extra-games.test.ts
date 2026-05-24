/**
 * @fileoverview Tests for the Extra Games Mechanism + the `noneMechanism` instance.
 *
 * Verifies the factory wires a Chart's compute through, and that the
 * pre-built noneMechanism returns the zero-handicap shape per the locked spec.
 *
 * @see ../extra-games.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { createExtraGamesMechanism, noneMechanism } from '../extra-games';
import {
  gamesNeeded3v3Chart,
  gamesNeeded5v5Chart,
} from '../../threshold-charts';

const NO_OVERRIDES = {};

describe('createExtraGamesMechanism — factory wires Chart through', () => {
  it('returns a Mechanism with kind="extra_games"', () => {
    const mech = createExtraGamesMechanism(gamesNeeded3v3Chart);
    expect(mech.kind).toBe('extra_games');
  });

  it('compute delegates to the bound Chart (3v3 wiring)', () => {
    const mech = createExtraGamesMechanism(gamesNeeded3v3Chart);
    expect(mech.compute(0, NO_OVERRIDES)).toEqual(gamesNeeded3v3Chart.compute(0));
    expect(mech.compute(6, NO_OVERRIDES)).toEqual(gamesNeeded3v3Chart.compute(6));
    expect(mech.compute(-12, NO_OVERRIDES)).toEqual(
      gamesNeeded3v3Chart.compute(-12),
    );
  });

  it('compute delegates to the bound Chart (5v5 wiring — different chart, same factory)', () => {
    const mech = createExtraGamesMechanism(gamesNeeded5v5Chart);
    expect(mech.compute(0, NO_OVERRIDES)).toEqual(gamesNeeded5v5Chart.compute(0));
    expect(mech.compute(15, NO_OVERRIDES)).toEqual(gamesNeeded5v5Chart.compute(15));
    expect(mech.compute(145, NO_OVERRIDES)).toEqual(
      gamesNeeded5v5Chart.compute(145),
    );
  });

  it('compute ignores overrides today (reserved for future per-mechanism dials)', () => {
    const mech = createExtraGamesMechanism(gamesNeeded3v3Chart);
    expect(mech.compute(2, NO_OVERRIDES)).toEqual(
      mech.compute(2, { winner_points: 99 }),
    );
  });
});

describe('noneMechanism — zero-handicap pre-built instance', () => {
  it('kind is "extra_games" (collapses to zero per locked spec)', () => {
    expect(noneMechanism.kind).toBe('extra_games');
  });

  it('compute returns zero-handicap shape at any diff', () => {
    const expected = {
      games_to_win: 0,
      games_to_tie: null,
      games_to_lose: null,
    };
    expect(noneMechanism.compute(0, NO_OVERRIDES)).toEqual(expected);
    expect(noneMechanism.compute(50, NO_OVERRIDES)).toEqual(expected);
    expect(noneMechanism.compute(-100, NO_OVERRIDES)).toEqual(expected);
  });
});
