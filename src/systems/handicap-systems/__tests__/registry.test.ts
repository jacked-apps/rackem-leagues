/**
 * @fileoverview Tests for the Handicap Systems registry / factory.
 *
 * Verifies `getHandicapSystem(handicapType)` routes to the correct variant for each
 * of the four `HandicapType` values.
 *
 * @see ../index.ts — the function under test
 */

import { describe, it, expect } from 'vitest';
import {
  getHandicapSystem,
  pointsHandicapSystem,
  percentageHandicapSystem,
  fargoRateHandicapSystem,
  skillLevelHandicapSystem,
} from '../index';

describe('getHandicapSystem — selection by handicapType', () => {
  it('routes "points" to pointsHandicapSystem', () => {
    expect(getHandicapSystem('points')).toBe(pointsHandicapSystem);
  });

  it('routes "percentage" to percentageHandicapSystem', () => {
    expect(getHandicapSystem('percentage')).toBe(percentageHandicapSystem);
  });

  it('routes "fargo" to fargoRateHandicapSystem', () => {
    expect(getHandicapSystem('fargo')).toBe(fargoRateHandicapSystem);
  });

  it('routes "skill_level" to skillLevelHandicapSystem', () => {
    expect(getHandicapSystem('skill_level')).toBe(skillLevelHandicapSystem);
  });

  it('returned module has the matching kind discriminator', () => {
    expect(getHandicapSystem('points').kind).toBe('points');
    expect(getHandicapSystem('percentage').kind).toBe('percentage');
    expect(getHandicapSystem('fargo').kind).toBe('fargo');
    expect(getHandicapSystem('skill_level').kind).toBe('skill_level');
  });
});
