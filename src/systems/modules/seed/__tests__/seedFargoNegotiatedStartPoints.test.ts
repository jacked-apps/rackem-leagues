/**
 * @fileoverview Tests for seedFargoNegotiatedStartPoints.
 */

import { describe, it, expect } from 'vitest';
import { seedFargoNegotiatedStartPoints } from '../seedFargoNegotiatedStartPoints';
import type { StateBag } from '@/systems/chain-runtime/types';

describe('seedFargoNegotiatedStartPoints', () => {
  it('passes negotiated home_to_tie/away_to_tie through to bag', async () => {
    const bag: StateBag = {};
    await seedFargoNegotiatedStartPoints.run(bag, {
      matchData: { home_to_tie: 8, away_to_tie: 0 },
    });
    expect(bag.negotiated_home_start_points).toBe(8);
    expect(bag.negotiated_away_start_points).toBe(0);
  });

  it('preserves a value of 0 (does not coerce to null)', async () => {
    const bag: StateBag = {};
    await seedFargoNegotiatedStartPoints.run(bag, {
      matchData: { home_to_tie: 0, away_to_tie: 0 },
    });
    expect(bag.negotiated_home_start_points).toBe(0);
    expect(bag.negotiated_away_start_points).toBe(0);
  });

  it('writes null when matchData is missing', async () => {
    const bag: StateBag = {};
    await seedFargoNegotiatedStartPoints.run(bag, {});
    expect(bag.negotiated_home_start_points).toBeNull();
    expect(bag.negotiated_away_start_points).toBeNull();
  });

  it('writes null for individually-missing values', async () => {
    const bag: StateBag = {};
    await seedFargoNegotiatedStartPoints.run(bag, {
      matchData: { home_to_tie: 5 },
    });
    expect(bag.negotiated_home_start_points).toBe(5);
    expect(bag.negotiated_away_start_points).toBeNull();
  });

  it('never throws on null matchData', () => {
    const bag: StateBag = {};
    expect(() => seedFargoNegotiatedStartPoints.run(bag, { matchData: null })).not.toThrow();
  });
});
