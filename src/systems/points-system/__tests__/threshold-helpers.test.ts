/**
 * @fileoverview Tests for the Threshold factory helpers.
 *
 * @see ../threshold-helpers.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import {
  constantThreshold,
  prefThreshold,
  computedThreshold,
  resolveAllThresholds,
} from '../threshold-helpers';
import type { ThresholdInputs } from '../types';

const emptyInputs: ThresholdInputs = {
  homeRatings: [],
  awayRatings: [],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 0,
  prefs: {},
};

describe('constantThreshold', () => {
  it('always returns the configured value', () => {
    const t = constantThreshold('jumpValue', 1.5);
    expect(t.name).toBe('jumpValue');
    expect(t.compute(emptyInputs)).toBe(1.5);
    expect(t.compute({ ...emptyInputs, gameCount: 999 })).toBe(1.5);
  });
});

describe('prefThreshold', () => {
  it('reads the value from the prefs bag', () => {
    const t = prefThreshold('winTarget', 'games_to_win');
    expect(t.compute({ ...emptyInputs, prefs: { games_to_win: 13 } })).toBe(13);
  });

  it('throws when the pref is missing', () => {
    const t = prefThreshold('winTarget', 'missing_pref');
    expect(() => t.compute(emptyInputs)).toThrow(/expected numeric pref/);
  });

  it('throws when the pref is non-numeric', () => {
    const t = prefThreshold('winTarget', 'oops');
    expect(() => t.compute({ ...emptyInputs, prefs: { oops: 'not a number' } })).toThrow(
      /expected numeric pref/,
    );
  });
});

describe('computedThreshold', () => {
  it('wraps an arbitrary compute function', () => {
    // milestoneTarget = round(games_to_win × milestone_percent)
    const t = computedThreshold('milestoneTarget', (inputs) =>
      Math.round((inputs.prefs.games_to_win as number) * (inputs.prefs.milestone_percent as number)),
    );
    expect(
      t.compute({
        ...emptyInputs,
        prefs: { games_to_win: 13, milestone_percent: 0.7 },
      }),
    ).toBe(9);
  });
});

describe('resolveAllThresholds', () => {
  it('resolves a map of thresholds to a map of values', () => {
    const thresholds = {
      winTarget: prefThreshold('winTarget', 'games_to_win'),
      jumpValue: constantThreshold('jumpValue', 1.5),
      milestoneTarget: computedThreshold('milestoneTarget', (i) =>
        Math.round((i.prefs.games_to_win as number) * (i.prefs.milestone_percent as number)),
      ),
    };
    const inputs: ThresholdInputs = {
      ...emptyInputs,
      prefs: { games_to_win: 13, milestone_percent: 0.7 },
    };
    expect(resolveAllThresholds(thresholds, inputs)).toEqual({
      winTarget: 13,
      jumpValue: 1.5,
      milestoneTarget: 9,
    });
  });

  it('propagates errors from any threshold compute', () => {
    const thresholds = {
      ok: constantThreshold('ok', 1),
      bad: prefThreshold('bad', 'missing'),
    };
    expect(() => resolveAllThresholds(thresholds, emptyInputs)).toThrow();
  });
});
