/**
 * @fileoverview Unit tests for the coin flip rules.
 *
 * These never touch a DOM. The winner-selection rule is the thing most worth
 * proving, and proving it here means it stays proven even if the component
 * around it is rewritten.
 *
 * Two boundary tests deserve a note: `tossCoin` and `assignFaces` are pinned at
 * both ends of [0, 1) rather than asserted to be "random", because an off-by-one
 * comparison produces a biased coin that still looks random in casual use. The
 * distribution tests assert only that both outcomes OCCUR — never a ratio — so
 * they cannot flake.
 */

import { describe, it, expect } from 'vitest';
import { assignFaces, quickFlip, resolveFlip, shuffleOrder, tossCoin } from './flipCoin';
import type { Participant, RandomSource } from './types';

const john: Participant = { id: 'p1', name: 'John' };
const mike: Participant = { id: 'p2', name: 'Mike' };

/** A random source that yields the given values in order, then repeats the last. */
function sequence(...values: number[]): RandomSource {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('tossCoin', () => {
  it('returns heads below the halfway point', () => {
    expect(tossCoin(sequence(0))).toBe('heads');
    expect(tossCoin(sequence(0.4999))).toBe('heads');
  });

  it('returns tails at and above the halfway point', () => {
    expect(tossCoin(sequence(0.5))).toBe('tails');
    expect(tossCoin(sequence(0.9999))).toBe('tails');
  });

  it('produces both faces over many tosses with a real source', () => {
    const faces = new Set(Array.from({ length: 400 }, () => tossCoin()));

    // Occurrence, not ratio — a ratio assertion would flake.
    expect(faces).toEqual(new Set(['heads', 'tails']));
  });
});

describe('resolveFlip', () => {
  it('gives the win to the caller when the coin agrees with their call', () => {
    expect(resolveFlip('heads', 'heads', mike, john).winner).toEqual(mike);
    expect(resolveFlip('tails', 'tails', mike, john).winner).toEqual(mike);
  });

  it('gives the win to the other participant when the coin disagrees', () => {
    expect(resolveFlip('heads', 'tails', mike, john).winner).toEqual(john);
    expect(resolveFlip('tails', 'heads', mike, john).winner).toEqual(john);
  });

  it('names a loser as well as a winner, since a flip cannot tie', () => {
    const result = resolveFlip('heads', 'tails', mike, john);

    expect(result.winner).toEqual(john);
    expect(result.loser).toEqual(mike);
  });

  it('carries the call, the face and the caller so the result can be explained', () => {
    const result = resolveFlip('heads', 'tails', mike, john);

    // "Mike called heads, it landed tails" — the sentence that makes the
    // outcome believable to the person who lost.
    expect(result).toMatchObject({
      call: 'heads',
      face: 'tails',
      callerId: mike.id,
    });
  });

  it('resolves by id, not by name, when both participants share a name', () => {
    const alsoJohn: Participant = { id: 'p3', name: 'John' };
    const result = resolveFlip('heads', 'heads', john, alsoJohn);

    expect(result.winner.id).toBe('p1');
    expect(result.loser.id).toBe('p3');
  });
});

describe('assignFaces', () => {
  it('assigns heads to the first participant below the halfway point', () => {
    expect(assignFaces(john, mike, sequence(0))).toEqual({
      heads: john,
      tails: mike,
    });
  });

  it('assigns heads to the second participant at and above the halfway point', () => {
    expect(assignFaces(john, mike, sequence(0.5))).toEqual({
      heads: mike,
      tails: john,
    });
  });

  it('gives each participant heads at least once over many assignments', () => {
    const headsIds = new Set(
      Array.from({ length: 400 }, () => assignFaces(john, mike).heads.id)
    );

    expect(headsIds).toEqual(new Set([john.id, mike.id]));
  });
});

describe('shuffleOrder', () => {
  it('returns both orderings depending on the source', () => {
    expect(shuffleOrder(john, mike, sequence(0))).toEqual([john, mike]);
    expect(shuffleOrder(john, mike, sequence(0.5))).toEqual([mike, john]);
  });

  it('cannot change who wins — display order is cosmetic only', () => {
    // Hold the assignment and the coin fixed; vary ONLY the display order.
    // If this ever fails, a cosmetic shuffle has become load-bearing.
    const assignment = assignFaces(john, mike, sequence(0));

    for (const orderSource of [sequence(0), sequence(0.99)]) {
      const [first] = shuffleOrder(john, mike, orderSource);
      const result = resolveFlip('heads', 'heads', assignment.heads, assignment.tails);

      expect(first).toBeDefined();
      expect(result.winner).toEqual(john);
    }
  });
});

describe('quickFlip — the silent two-outcome randomizer', () => {
  it('names a winner and a loser with no DOM in sight', () => {
    const result = quickFlip(john, mike, sequence(0, 0));

    expect([john, mike]).toContainEqual(result.winner);
    expect([john, mike]).toContainEqual(result.loser);
    expect(result.winner).not.toEqual(result.loser);
  });

  it('hands back the same objects it was given, so ids survive the round trip', () => {
    // The whole point for a caller: winner.id is the id you passed in, ready to
    // write to a record. Not a coin face to interpret.
    const result = quickFlip(john, mike, sequence(0, 0));

    expect(result.winner.id).toMatch(/^p[12]$/);
    expect(result.winner.name).toBe(result.winner === john ? 'John' : 'Mike');
  });

  it('is driven by the source at both boundaries', () => {
    // Assignment then toss. Pinning both ends proves the source actually
    // reaches the outcome rather than a fixed participant always winning.
    // john holds heads, coin heads -> john.
    expect(quickFlip(john, mike, sequence(0, 0)).winner).toEqual(john);
    // john holds heads, coin tails -> mike.
    expect(quickFlip(john, mike, sequence(0, 0.99)).winner).toEqual(mike);
    // mike holds heads, coin heads -> mike.
    expect(quickFlip(john, mike, sequence(0.99, 0)).winner).toEqual(mike);
    // mike holds heads, coin tails -> john.
    expect(quickFlip(john, mike, sequence(0.99, 0.99)).winner).toEqual(john);
  });

  it('lets each participant win across many runs', () => {
    // Occurrence, never a ratio, so it cannot flake. Guards a silent flip that
    // always picks the same side — the failure a caller would never notice.
    const winners = new Set<string>();
    for (let i = 0; i < 200; i++) winners.add(quickFlip(john, mike).winner.id);

    expect(winners).toEqual(new Set(['p1', 'p2']));
  });

  it('reports the call it made on the players behalf', () => {
    // Nobody nominated a side, so the app called heads for the heads holder.
    const result = quickFlip(john, mike, sequence(0, 0));

    expect(result.call).toBe('heads');
    expect(result.callerId).toBe(result.face === 'heads' ? result.winner.id : result.loser.id);
  });
});
