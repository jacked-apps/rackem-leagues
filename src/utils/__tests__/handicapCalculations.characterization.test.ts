/**
 * @fileoverview Characterization tests for handicapCalculations utilities.
 *
 * Locks `getSubstituteHandicapOptions(variant)` — the valid handicap values
 * for a substitute player based on the league's variant. Pure function; tiny
 * but consumed by lineup UI.
 *
 * The team-bonus formula that used to live here (`calculateTeamHandicap`) was
 * merged into `getTeamHandicapBonus` on 2026-11-01 so the lineup screen and
 * match setup can't disagree; its cases now live in
 * `getTeamHandicapBonus.characterization.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { getSubstituteHandicapOptions } from '../handicapCalculations';

describe('getSubstituteHandicapOptions — characterization', () => {
  it('"standard" variant returns -2..+2 inclusive', () => {
    expect(getSubstituteHandicapOptions('standard')).toEqual([-2, -1, 0, 1, 2]);
  });

  it('"reduced" variant returns -1..+1 inclusive', () => {
    expect(getSubstituteHandicapOptions('reduced')).toEqual([-1, 0, 1]);
  });

  it('"none" variant returns [0] (single zero option)', () => {
    expect(getSubstituteHandicapOptions('none')).toEqual([0]);
  });
});
