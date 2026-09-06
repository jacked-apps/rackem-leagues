/**
 * @fileoverview Round-1 pairing preview for the review step.
 *
 * Maps the engine's seed-based round-1 pairs onto the organizer's ordered
 * participant names so they can sanity-check matchups (and see byes) BEFORE the
 * bracket goes live. For "random" mode the shuffle happens at submit, so an
 * exact preview isn't possible — the caller shows a "pairings assigned at start"
 * note instead of calling this.
 */

import { roundOnePairs } from '@/utils/bracket/seeding';

export interface PreviewPairing {
  home: string | null; // null = bye
  away: string | null;
}

/**
 * Build the round-1 matchup preview. `names` are in seed order (seed 1 = index
 * 0). A null side is a bye — that seed advances automatically.
 */
export function buildPairingPreview(names: string[]): PreviewPairing[] {
  const pairs = roundOnePairs(names.length);
  return pairs.map((p) => ({
    home: p.home !== null ? names[p.home - 1] : null,
    away: p.away !== null ? names[p.away - 1] : null,
  }));
}
