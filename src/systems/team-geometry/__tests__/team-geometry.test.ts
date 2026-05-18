/**
 * @fileoverview Tests for the Team Geometry Module factory + game-count derivation.
 *
 * Phase A of Unit 1 — unit tests in isolation. No consumer integration yet.
 *
 * @see ../index.ts — the functions under test
 * @see ../types.ts — `TeamGeometry`, `GameGeneration`
 */

import { describe, it, expect } from 'vitest';
import { computeGameCount, getTeamGeometry } from '../index';

describe('computeGameCount — pure derivation', () => {
  describe('single_round_robin', () => {
    it.each([
      [3, 9],
      [4, 16],
      [5, 25],
      [6, 36],
      [7, 49],
    ])('lineupSize=%i → gameCount=%i', (lineupSize, expected) => {
      expect(computeGameCount(lineupSize, 'single_round_robin')).toBe(expected);
    });
  });

  describe('double_round_robin', () => {
    it.each([
      [3, 18],
      [4, 32],
      [5, 50],
      [6, 72],
    ])('lineupSize=%i → gameCount=%i', (lineupSize, expected) => {
      expect(computeGameCount(lineupSize, 'double_round_robin')).toBe(expected);
    });
  });

  it('canonical shipping cases match prepackaged Scoring Systems', () => {
    // BCA 3v3 DRR ships 18 games.
    expect(computeGameCount(3, 'double_round_robin')).toBe(18);
    // BCA 5v5 SRR ships 25 games (also FargoRate 10-Point 5-Man).
    expect(computeGameCount(5, 'single_round_robin')).toBe(25);
  });
});

describe('getTeamGeometry — factory', () => {
  it('returns a Module with all three axes + derived gameCount', () => {
    const tg = getTeamGeometry(3, 5, 'double_round_robin');
    expect(tg).toEqual({
      lineupSize: 3,
      maxRosterSize: 5,
      gameGeneration: 'double_round_robin',
      gameCount: 18,
    });
  });

  it('canonical 3v3 (Points 3-Man) configuration', () => {
    const tg = getTeamGeometry(3, 5, 'double_round_robin');
    expect(tg.lineupSize).toBe(3);
    expect(tg.maxRosterSize).toBe(5);
    expect(tg.gameGeneration).toBe('double_round_robin');
    expect(tg.gameCount).toBe(18);
  });

  it('canonical 5v5 SRR (Percentage 5-Man / FargoRate 10-Point 5-Man) configuration', () => {
    const tg = getTeamGeometry(5, 8, 'single_round_robin');
    expect(tg.lineupSize).toBe(5);
    expect(tg.maxRosterSize).toBe(8);
    expect(tg.gameGeneration).toBe('single_round_robin');
    expect(tg.gameCount).toBe(25);
  });

  it('max_roster_size is administrative only — accepted as-is without affecting other axes', () => {
    // Same lineup + game_generation, different roster cap → same gameCount.
    const tg1 = getTeamGeometry(3, 5, 'double_round_robin');
    const tg2 = getTeamGeometry(3, 10, 'double_round_robin');
    expect(tg1.gameCount).toBe(tg2.gameCount);
    expect(tg1.maxRosterSize).toBe(5);
    expect(tg2.maxRosterSize).toBe(10);
  });

  it('hypothetical 4v4 DRR composes to 32 games', () => {
    const tg = getTeamGeometry(4, 7, 'double_round_robin');
    expect(tg.gameCount).toBe(32);
  });

  it('hypothetical 6v6 SRR composes to 36 games', () => {
    const tg = getTeamGeometry(6, 10, 'single_round_robin');
    expect(tg.gameCount).toBe(36);
  });
});

describe('TeamGeometry contract — passive configuration', () => {
  it('no methods on the constructed Module — pure data', () => {
    const tg = getTeamGeometry(3, 5, 'double_round_robin');
    // All keys should be data (numbers / strings), not functions.
    const keys = Object.keys(tg);
    for (const key of keys) {
      const value = (tg as unknown as Record<string, unknown>)[key];
      expect(typeof value).not.toBe('function');
    }
  });

  it('gameCount is derived consistently from inputs (referential transparency)', () => {
    // Two calls with the same inputs → same gameCount.
    const tg1 = getTeamGeometry(3, 5, 'double_round_robin');
    const tg2 = getTeamGeometry(3, 5, 'double_round_robin');
    expect(tg1.gameCount).toBe(tg2.gameCount);
  });
});
