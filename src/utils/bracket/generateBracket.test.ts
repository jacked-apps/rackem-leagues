/**
 * @fileoverview Unit tests for the bracket generation engine (Unit 2).
 *
 * Single-elimination structure, byes for non-power-of-two fields, small fields,
 * structural validity (acyclic, resolvable pointers, one terminal), the
 * match-count property, and determinism. Double-elimination arrives in Unit 2b.
 *
 * Pure logic — runs in the `unit` vitest project (happy-dom, parallel).
 */

import { describe, it, expect } from 'vitest';
import { generateBracket, generateSingleElim } from './generateBracket';
import { nextPow2, seedSlots, roundOnePairs } from './seeding';
import type { GeneratedBracket } from '@/types/bracket';

/** Assert the tree is well-formed: unique keys, resolvable + acyclic pointers,
 *  expected match count, and exactly `terminals` matches with no next pointer. */
function assertValidTree(
  matches: GeneratedBracket,
  opts: { count: number; terminals: number }
) {
  const keys = new Set(matches.map((m) => m.key));
  expect(keys.size).toBe(matches.length); // unique keys
  expect(matches.length).toBe(opts.count);

  const byKey = new Map(matches.map((m) => [m.key, m]));
  let terminalCount = 0;
  for (const m of matches) {
    for (const ptr of [m.nextMatchKey, m.loserNextMatchKey]) {
      if (ptr !== null) expect(byKey.has(ptr)).toBe(true); // resolves
    }
    if (m.nextMatchKey === null && !m.isResetMatch) terminalCount++;

    // No cycle: walking winner pointers must terminate within #matches steps.
    let hops = 0;
    let cur = m.nextMatchKey;
    const seen = new Set<string>();
    while (cur !== null) {
      expect(seen.has(cur)).toBe(false); // revisiting = cycle
      seen.add(cur);
      cur = byKey.get(cur)!.nextMatchKey;
      expect(++hops).toBeLessThanOrEqual(matches.length);
    }
  }
  expect(terminalCount).toBe(opts.terminals);
}

describe('seeding', () => {
  it('nextPow2 rounds up to a power of two', () => {
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(13)).toBe(16);
    expect(nextPow2(16)).toBe(16);
  });

  it('seedSlots(8) spreads top seeds (1 and 2 in opposite halves)', () => {
    const slots = seedSlots(8);
    expect(slots.length).toBe(8);
    expect(new Set(slots)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8])); // a permutation
    expect(slots[0]).toBe(1); // seed 1 anchors the top
    const firstHalf = slots.slice(0, 4);
    const secondHalf = slots.slice(4);
    expect(firstHalf).toContain(1);
    expect(secondHalf).toContain(2); // 1 and 2 can only meet in the final
  });

  it('roundOnePairs assigns byes to the TOP seeds for a non-power-of-two field', () => {
    const pairs = roundOnePairs(13); // size 16 → 3 byes
    const byeSeeds = pairs
      .filter((p) => (p.home === null) !== (p.away === null))
      .map((p) => (p.home ?? p.away)!);
    expect(byeSeeds.sort((a, b) => a - b)).toEqual([1, 2, 3]);
    // Every round-1 match has at least one real player (no all-bye match).
    for (const p of pairs) expect(p.home !== null || p.away !== null).toBe(true);
  });
});

describe('generateSingleElim', () => {
  it('8 players → 7 matches, seed 1 vs 8 in round 1, chains to one final', () => {
    const m = generateSingleElim(8);
    assertValidTree(m, { count: 7, terminals: 1 });

    const r1 = m.filter((x) => x.round === 1);
    expect(r1.length).toBe(4);
    expect(r1[0].homeSeed).toBe(1);
    expect(r1[0].awaySeed).toBe(8);
    // W1-0 and W1-1 both feed W2-0 (opposite slots).
    expect(r1[0].nextMatchKey).toBe('W2-0');
    expect(r1[0].nextMatchSlot).toBe('home');
    expect(r1[1].nextMatchKey).toBe('W2-0');
    expect(r1[1].nextMatchSlot).toBe('away');
    // All real round-1 matches are ready.
    expect(r1.every((x) => x.status === 'ready')).toBe(true);
  });

  it('13 players → 3 byes (seeds 1–3), shown as completed round-1 matches', () => {
    const m = generateSingleElim(13);
    // A FULL bracket now: 16 slots ⇒ 15 matches, byes included. They used to be
    // elided, which left a top seed appearing in round 2 unexplained.
    assertValidTree(m, { count: 15, terminals: 1 });

    const r1 = m.filter((x) => x.round === 1);
    expect(r1.length).toBe(8); // every conceptual pair is a row

    const byes = r1.filter((x) => x.homeSeed === null || x.awaySeed === null);
    expect(byes.length).toBe(3);
    // A bye is already decided, and its lone player is the winner.
    for (const b of byes) {
      expect(b.status).toBe('complete');
      expect(b.winnerSeed).toBe(b.homeSeed ?? b.awaySeed);
    }
    expect(byes.map((b) => b.winnerSeed).sort((a, b) => a! - b!)).toEqual([1, 2, 3]);

    // The bye winners still stand in their round-2 slots, exactly as a played
    // match's winner would.
    const r2Seeds = m
      .filter((x) => x.round === 2)
      .flatMap((x) => [x.homeSeed, x.awaySeed])
      .filter((s): s is number => s !== null);
    for (const seed of [1, 2, 3]) expect(r2Seeds).toContain(seed);
  });

  it('2 players → a single ready match, no next pointer', () => {
    const m = generateSingleElim(2);
    expect(m.length).toBe(1);
    expect(m[0].homeSeed).toBe(1);
    expect(m[0].awaySeed).toBe(2);
    expect(m[0].status).toBe('ready');
    expect(m[0].nextMatchKey).toBeNull();
  });

  it('3 players → 1 bye to seed 1, who is already in the final', () => {
    const m = generateSingleElim(3);
    assertValidTree(m, { count: 3, terminals: 1 }); // 4-slot bracket

    const r1 = m.filter((x) => x.round === 1);
    expect(r1.length).toBe(2); // seeds 2 v 3, and seed 1's bye
    const bye = r1.find((x) => x.homeSeed === null || x.awaySeed === null)!;
    expect(bye.winnerSeed).toBe(1);
    expect(bye.status).toBe('complete');

    const final = m.find((x) => x.round === 2)!;
    expect([final.homeSeed, final.awaySeed]).toContain(1);
  });

  it('produces a FULL bracket — nextPow2(N) - 1 matches, byes included', () => {
    // Byes are rows now, so the tree is always the full shape for the bracket
    // size rather than shrinking to the field. A power-of-two field is
    // unchanged, since it has no byes.
    for (const n of [2, 3, 4, 5, 7, 8, 13, 16, 32, 64]) {
      const size = 2 ** Math.ceil(Math.log2(n));
      expect(generateSingleElim(n).length).toBe(size - 1);
    }
  });

  it('a bye never routes a loser — nobody has lost one', () => {
    const m = generateSingleElim(13);
    const byes = m.filter(
      (x) => x.round === 1 && (x.homeSeed === null || x.awaySeed === null)
    );
    expect(byes.length).toBeGreaterThan(0);
    for (const b of byes) expect(b.loserNextMatchKey).toBeNull();
  });

  it('is deterministic — same field yields an identical tree', () => {
    expect(generateSingleElim(13)).toEqual(generateSingleElim(13));
  });
});

describe('generateBracket', () => {
  it('dispatches single-elimination', () => {
    const m = generateBracket(8, { format: 'single_elimination' });
    expect(m.length).toBe(7);
  });

  it('throws for fewer than 2 participants', () => {
    expect(() => generateBracket(1, { format: 'single_elimination' })).toThrow();
    expect(() => generateBracket(0, { format: 'single_elimination' })).toThrow();
  });
});

describe('generateDoubleElim', () => {
  const de = (n: number, reset = false) =>
    generateBracket(n, { format: 'double_elimination', grandFinalReset: reset });

  it('8 players → 14 matches (2N-2): WB + LB + one grand final, no reset', () => {
    const m = de(8);
    assertValidTree(m, { count: 14, terminals: 1 });
    expect(m.filter((x) => x.side === 'winners').length).toBe(7); // N-1 WB
    expect(m.filter((x) => x.side === 'losers').length).toBe(6); // LB
    expect(m.filter((x) => x.side === 'grand_final').length).toBe(1);
    // Round-1 WB is standard-seeded.
    const w1 = m.filter((x) => x.side === 'winners' && x.round === 1);
    expect(w1[0].homeSeed).toBe(1);
    expect(w1[0].awaySeed).toBe(8);
    // Every WB match drops its loser somewhere.
    expect(m.filter((x) => x.side === 'winners').every((x) => x.loserNextMatchKey !== null)).toBe(true);
  });

  it('reset flag adds a conditional grand-final decider (2N-1 rows)', () => {
    const m = de(8, true);
    expect(m.length).toBe(15);
    const reset = m.filter((x) => x.isResetMatch);
    expect(reset.length).toBe(1);
    expect(reset[0].side).toBe('grand_final');
    // The reset node has no incoming pointer (runtime-activated only).
    const pointsToReset = m.some(
      (x) => x.nextMatchKey === reset[0].key || x.loserNextMatchKey === reset[0].key
    );
    expect(pointsToReset).toBe(false);
  });

  it('drop routing: WB round r loser → LB round 2r-2 (final loser → LB final)', () => {
    const m = de(8);
    const byKey = new Map(m.map((x) => [x.key, x]));
    const lbFinalRound = 2 * 3 - 2; // d=3 → LB round 4
    const wbFinal = m.find((x) => x.side === 'winners' && x.round === 3)!;
    const dropTarget = byKey.get(wbFinal.loserNextMatchKey!)!;
    expect(dropTarget.side).toBe('losers');
    expect(dropTarget.round).toBe(lbFinalRound);
    // A WB round-2 loser drops into an LB round-2 match.
    const wb2 = m.find((x) => x.side === 'winners' && x.round === 2)!;
    expect(byKey.get(wb2.loserNextMatchKey!)!.round).toBe(2);
  });

  it('4 players → 6 matches (the smallest normal double-elim)', () => {
    assertValidTree(de(4), { count: 6, terminals: 1 });
  });

  it('2 players → WB final + grand final (degenerate, 2 matches)', () => {
    const m = de(2);
    assertValidTree(m, { count: 2, terminals: 1 });
    expect(m.filter((x) => x.side === 'losers').length).toBe(0);
  });

  it('non-power-of-two fields stay valid, with byes as visible round-1 matches', () => {
    for (const n of [3, 5, 6, 7, 11, 13]) {
      const m = de(n);
      const byes = m.filter(
        (x) => x.side === 'winners' && x.round === 1 && (x.homeSeed === null || x.awaySeed === null)
      );
      // The bracket size, not the field size, decides how many byes there are.
      expect(byes.length).toBe(2 ** Math.ceil(Math.log2(n)) - n);
      assertValidTree(m, { count: 2 * n - 2 + byes.length, terminals: 1 });

      for (const b of byes) {
        expect(b.status).toBe('complete');
        expect(b.winnerSeed).toBe(b.homeSeed ?? b.awaySeed);
        // Nobody lost, so nobody drops. The losers bracket is sized on that.
        expect(b.loserNextMatchKey).toBeNull();
        // It still advances its player, exactly as a played match would.
        expect(b.nextMatchKey).not.toBeNull();
      }

      // Byes never leave a match with two empty slots waiting on nothing.
      expect(m.every((x) => x.homeSeed !== null || x.awaySeed !== null || x.status === 'pending')).toBe(true);
    }
  });

  it('adds exactly one match per bye and nothing else', () => {
    // 2N-2 is the playable-match count; each bye is one extra visible row.
    for (const n of [2, 3, 4, 5, 8, 13, 16, 32]) {
      const byeCount = 2 ** Math.ceil(Math.log2(n)) - n;
      expect(de(n).length).toBe(2 * n - 2 + byeCount);
    }
  });

  it('a power-of-two field is completely unchanged — no byes to add', () => {
    for (const n of [2, 4, 8, 16, 32]) {
      const m = de(n);
      expect(m.length).toBe(2 * n - 2);
      expect(m.some((x) => x.homeSeed === null && x.status === 'complete')).toBe(false);
    }
  });

  it('is deterministic — same field yields an identical tree', () => {
    expect(de(13)).toEqual(de(13));
  });
});
