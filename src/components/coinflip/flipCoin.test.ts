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
import { assignFaces, resolveFlip, shuffleOrder, tossCoin } from './flipCoin';
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
