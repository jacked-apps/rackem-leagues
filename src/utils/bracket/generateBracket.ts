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
import { generateDoubleElim } from './doubleElim';

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
 * Byes are REAL, COMPLETED round-1 matches: one seed, an empty opposite slot,
 * and that seed already recorded as the winner and placed in round 2.
 *
 * They used to be elided, which made a top seed simply appear in round 2 with
 * no explanation — the mistake tournament guides name outright ("the most
 * common mistake is hiding byes inside a bracket image; label them clearly in
 * the first round"). Emitting them also gives a late entrant somewhere to sit:
 * an empty chair opposite a player who is waiting for an opponent who never
 * entered.
 *
 * A bye routes NO loser. Nobody has lost, and the losers bracket is sized on
 * the assumption that nobody arrives from here.
 */
export function generateSingleElim(participantCount: number): GeneratedBracket {
  const size = nextPow2(participantCount);
  const rounds = log2(size);
  const matches: GeneratedMatch[] = [];
  const byKey = new Map<string, GeneratedMatch>();

  // Round 1: every conceptual pair becomes a match. A pair with only one real
  // seed becomes a BYE — already complete, its lone player already the winner.
  const pairs = roundOnePairs(participantCount); // size/2 conceptual pairs
  type Resolution =
    | { type: 'match'; key: string }
    | { type: 'bye'; key: string; seed: number };
  const resolutions: Resolution[] = pairs.map((pair, i) => {
    const hasHome = pair.home !== null;
    const hasAway = pair.away !== null;
    const m = makeMatch(`W1-${i}`, 1, 'winners', i);
    m.homeSeed = pair.home;
    m.awaySeed = pair.away;

    if (hasHome && hasAway) {
      m.status = 'ready';
      matches.push(m);
      byKey.set(m.key, m);
      return { type: 'match', key: m.key };
    }

    // A bye: the one real seed has already won it, and is placed into round 2
    // below exactly as a played match's winner would be.
    const seed = (pair.home ?? pair.away)!;
    m.winnerSeed = seed;
    m.status = 'complete';
    matches.push(m);
    byKey.set(m.key, m);
    return { type: 'bye', key: m.key, seed };
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

  // Connect round 1 into round 2: conceptual pair i feeds W2-floor(i/2). Every
  // round-1 match now wires its winner pointer — a bye additionally has its
  // winner ALREADY placed in that slot, which is the same state a real match
  // reaches the moment it is decided.
  if (rounds >= 2) {
    resolutions.forEach((res, i) => {
      const targetKey = `W2-${Math.floor(i / 2)}`;
      const slot: MatchSlot = i % 2 === 0 ? 'home' : 'away';
      const m = byKey.get(res.key)!;
      m.nextMatchKey = targetKey;
      m.nextMatchSlot = slot;
      if (res.type === 'bye') placeSeed(byKey.get(targetKey)!, slot, res.seed);
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
  return generateDoubleElim(participantCount, options.grandFinalReset ?? false);
}
