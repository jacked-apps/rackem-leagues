/**
 * @fileoverview Tests for the Match Format Module factory + helpers.
 *
 * Phase A of the Match Format extraction Unit — unit tests in isolation. No consumer
 * integration yet.
 *
 * @see ../index.ts — the functions under test
 * @see ../types.ts — `MatchFormat`, `PairingFormat`
 */

import { describe, it, expect } from 'vitest';
import { getMatchFormat, isRaceMode } from '../index';

describe('getMatchFormat — factory', () => {
  it('returns a Module with both axes — single_rack with null raceLength', () => {
    const mf = getMatchFormat('single_rack', null);
    expect(mf).toEqual({
      pairingFormat: 'single_rack',
      raceLength: null,
    });
  });

  it('returns a Module with both axes — race_to_n with positive raceLength', () => {
    const mf = getMatchFormat('race_to_n', 7);
    expect(mf).toEqual({
      pairingFormat: 'race_to_n',
      raceLength: 7,
    });
  });

  it('canonical shipping configuration — all 3 prepackaged systems use single_rack', () => {
    // BCA 3v3, BCA 5v5, Fargo 5v5 all ship single_rack with null raceLength.
    const mf = getMatchFormat('single_rack', null);
    expect(mf.pairingFormat).toBe('single_rack');
    expect(mf.raceLength).toBeNull();
  });

  it('race_to_n race-to-5 configuration', () => {
    const mf = getMatchFormat('race_to_n', 5);
    expect(mf.pairingFormat).toBe('race_to_n');
    expect(mf.raceLength).toBe(5);
  });

  it('race_to_n race-to-3 configuration', () => {
    const mf = getMatchFormat('race_to_n', 3);
    expect(mf.pairingFormat).toBe('race_to_n');
    expect(mf.raceLength).toBe(3);
  });

  it('single_rack with non-null raceLength is constructed as-is (downstream ignores it)', () => {
    // Edge case: preference write SHOULD have prevented this combination, but if it slips
    // through, the factory carries the value rather than throwing. Downstream Pairings
    // Generator is responsible for ignoring race_length when pairingFormat is single_rack.
    const mf = getMatchFormat('single_rack', 7);
    expect(mf.pairingFormat).toBe('single_rack');
    expect(mf.raceLength).toBe(7); // carried as-is, not nulled
  });
});

describe('isRaceMode — predicate helper', () => {
  it('returns true for race_to_n', () => {
    const mf = getMatchFormat('race_to_n', 5);
    expect(isRaceMode(mf)).toBe(true);
  });

  it('returns false for single_rack', () => {
    const mf = getMatchFormat('single_rack', null);
    expect(isRaceMode(mf)).toBe(false);
  });

  it('returns false for single_rack regardless of raceLength value', () => {
    const mf = getMatchFormat('single_rack', 7);
    expect(isRaceMode(mf)).toBe(false);
  });
});

describe('MatchFormat contract — passive configuration', () => {
  it('no methods on the constructed Module — pure data', () => {
    const mf = getMatchFormat('race_to_n', 7);
    const keys = Object.keys(mf);
    for (const key of keys) {
      const value = (mf as unknown as Record<string, unknown>)[key];
      expect(typeof value).not.toBe('function');
    }
  });

  it('two calls with same inputs produce equal Modules (referential transparency)', () => {
    const mf1 = getMatchFormat('race_to_n', 5);
    const mf2 = getMatchFormat('race_to_n', 5);
    expect(mf1).toEqual(mf2);
  });
});
