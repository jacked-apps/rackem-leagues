/**
 * @fileoverview The bracket generation engine (Free Tier v1).
 *
 * Produces the full in-memory match tree for a bracket of N participants. Pure
 * and deterministic: it works purely on SEED positions (1..N), so the data
 * layer resolves the seeding mode (manual order vs shuffle) into a seed order
 * ONCE before calling, then maps seed → participant uuid on persist. The
 * engine never shuffles, so a persisted bracket is never re-derived.
 *
 * v1 uses the standard "spread" seed placement for every mode — the mode only
 * decides the initial seed order (resolved upstream). This is the "works, not
 * perfect" bar: a valid bracket for any field, not an analytically tuned one.
 *
 * Single-elimination is implemented here. Double-elimination lives in
 * ./doubleElim and is dispatched below.
 */

import type {
  GeneratedBracket,
  GeneratedMatch,
  GenerateBracketOptions,
  MatchSlot,
} from '@/types/bracket';
import { nextPow2, roundOnePairs } from './seeding';

/** Integer log2 of a power of two. */
function log2(size: number): number {
  return Math.round(Math.log2(size));
}

/** Fresh empty match node. */
function makeMatch(
  key: string,
  round: number,
  side: GeneratedMatch['side'],
  slot: number
): GeneratedMatch {
  return {
    key,
    round,
    side,
    slot,
    homeSeed: null,
    awaySeed: null,
    winnerSeed: null,
    status: 'pending',
    nextMatchKey: null,
    nextMatchSlot: null,
    loserNextMatchKey: null,
    loserNextMatchSlot: null,
    isResetMatch: false,
  };
}

/** Place a seed into a match's home/away slot (used for byes + advancement). */
function placeSeed(match: GeneratedMatch, slot: MatchSlot, seed: number): void {
  if (slot === 'home') match.homeSeed = seed;
  else match.awaySeed = seed;
}

/**
 * Generate the single-elimination winners tree for N participants.
 *
 * Exactly `N-1` matches — a bye is NOT a match. Byes (nextPow2(N) - N, on the
 * top seeds) are resolved by placing that seed directly into its round-2 slot,
 * so a top seed with a bye simply starts in round 2. Round-1 rows exist only
 * for real (both-sides-real) pairings.
 */
export function generateSingleElim(participantCount: number): GeneratedBracket {
  const size = nextPow2(participantCount);
  const rounds = log2(size);
  const matches: GeneratedMatch[] = [];
  const byKey = new Map<string, GeneratedMatch>();

  // Round 1: materialize a match only for real pairings; a bye resolves to the
  // real seed which we route into round 2 below.
  const pairs = roundOnePairs(participantCount); // size/2 conceptual pairs
  type Resolution = { type: 'match'; key: string } | { type: 'bye'; seed: number };
  const resolutions: Resolution[] = pairs.map((pair, i) => {
    const hasHome = pair.home !== null;
    const hasAway = pair.away !== null;
    if (hasHome && hasAway) {
      const m = makeMatch(`W1-${i}`, 1, 'winners', i);
      m.homeSeed = pair.home;
      m.awaySeed = pair.away;
      m.status = 'ready';
      matches.push(m);
      byKey.set(m.key, m);
      return { type: 'match', key: m.key };
    }
    return { type: 'bye', seed: (pair.home ?? pair.away)! };
  });

  // Rounds 2..k: fully materialized (every one is a real potential game).
  for (let r = 2; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let i = 0; i < count; i++) {
      const m = makeMatch(`W${r}-${i}`, r, 'winners', i);
      matches.push(m);
      byKey.set(m.key, m);
    }
  }

  // Wire winner pointers for rounds 2..k-1 → next round.
  for (let r = 2; r < rounds; r++) {
    const count = size / 2 ** r;
    for (let i = 0; i < count; i++) {
      const m = byKey.get(`W${r}-${i}`)!;
      m.nextMatchKey = `W${r + 1}-${Math.floor(i / 2)}`;
      m.nextMatchSlot = i % 2 === 0 ? 'home' : 'away';
    }
  }

  // Connect round 1 into round 2: conceptual pair i feeds W2-floor(i/2). A real
  // match wires its winner pointer; a bye places its seed straight in.
  if (rounds >= 2) {
    resolutions.forEach((res, i) => {
      const targetKey = `W2-${Math.floor(i / 2)}`;
      const slot: MatchSlot = i % 2 === 0 ? 'home' : 'away';
      if (res.type === 'match') {
        const m = byKey.get(res.key)!;
        m.nextMatchKey = targetKey;
        m.nextMatchSlot = slot;
      } else {
        placeSeed(byKey.get(targetKey)!, slot, res.seed);
      }
    });
  }

  // Statuses for rounds >= 2: both slots filled (e.g. two byes met) → ready.
  for (const m of matches) {
    if (m.round === 1) continue; // already 'ready'
    m.status = m.homeSeed !== null && m.awaySeed !== null ? 'ready' : 'pending';
  }

  return matches;
}

/**
 * Generate a bracket's full match tree.
 *
 * @param participantCount number of real participants (>= 2)
 * @param options format + grand-final-reset flag
 * @throws if fewer than 2 participants (a bracket needs a match)
 */
export function generateBracket(
  participantCount: number,
  options: GenerateBracketOptions
): GeneratedBracket {
  if (participantCount < 2) {
    throw new Error('A bracket needs at least 2 participants.');
  }
  if (options.format === 'single_elimination') {
    return generateSingleElim(participantCount);
  }
  // Double-elimination lands in Unit 2b (./doubleElim).
  throw new Error('Double-elimination generation is not yet implemented.');
}
