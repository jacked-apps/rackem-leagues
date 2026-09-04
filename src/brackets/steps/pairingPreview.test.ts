/**
 * @fileoverview Tests for the round-1 pairing preview helper.
 */

import { describe, it, expect } from 'vitest';
import { buildPairingPreview } from './pairingPreview';

describe('buildPairingPreview', () => {
  it('maps seed pairs onto names (4 players → 2 matchups, no byes)', () => {
    const preview = buildPairingPreview(['Ann', 'Bo', 'Cy', 'Di']);
    expect(preview).toEqual([
      { home: 'Ann', away: 'Di' }, // seed 1 v 4
      { home: 'Bo', away: 'Cy' }, // seed 2 v 3
    ]);
  });

  it('marks byes as null for the top seeds (3 players → seed 1 gets a bye)', () => {
    const preview = buildPairingPreview(['Ann', 'Bo', 'Cy']);
    // Seed 1 (Ann) draws the phantom seed 4 → bye.
    const byeMatch = preview.find((m) => m.home === null || m.away === null)!;
    expect(byeMatch.home ?? byeMatch.away).toBe('Ann');
  });
});
