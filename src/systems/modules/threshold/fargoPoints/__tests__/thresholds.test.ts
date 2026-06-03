/**
 * @fileoverview Tests for fargoPoints.thresholds — passthrough of the
 * negotiated start-points values onto the *_to_tie columns.
 */

import { describe, it, expect } from 'vitest';
import { thresholds } from '../thresholds';
import type { StateBag } from '@/systems/chain-runtime/types';

describe('fargoPoints.thresholds', () => {
  it('copies negotiated start points to *_to_tie, nulls everything else', async () => {
    const bag: StateBag = {
      negotiated_home_start_points: 8,
      negotiated_away_start_points: 0,
    };
    await thresholds.run(bag, {});
    expect(bag.home_to_win).toBeNull();
    expect(bag.home_to_tie).toBe(8);
    expect(bag.home_to_lose).toBeNull();
    expect(bag.away_to_win).toBeNull();
    expect(bag.away_to_tie).toBe(0);
    expect(bag.away_to_lose).toBeNull();
  });

  it('preserves a negotiated value of 0 (does not coerce to null)', async () => {
    const bag: StateBag = {
      negotiated_home_start_points: 0,
      negotiated_away_start_points: 0,
    };
    await thresholds.run(bag, {});
    expect(bag.home_to_tie).toBe(0);
    expect(bag.away_to_tie).toBe(0);
  });

  it('writes null *_to_tie when negotiated values are missing', async () => {
    const bag: StateBag = {};
    await thresholds.run(bag, {});
    expect(bag.home_to_tie).toBeNull();
    expect(bag.away_to_tie).toBeNull();
  });

  it('writes null *_to_tie when negotiated values are null', async () => {
    const bag: StateBag = {
      negotiated_home_start_points: null,
      negotiated_away_start_points: null,
    };
    await thresholds.run(bag, {});
    expect(bag.home_to_tie).toBeNull();
    expect(bag.away_to_tie).toBeNull();
  });
});
