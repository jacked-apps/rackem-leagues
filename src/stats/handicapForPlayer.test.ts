/**
 * @fileoverview Tests for reading a handicap as it was on the night.
 *
 * The behaviour that matters most is the one nothing else would catch: this
 * must never fall back to a player's CURRENT handicap. There is no test for
 * that directly — the function has no access to current handicaps, which is the
 * design — but the null cases below are what keep it that way. A future
 * "helpful" fallback would have to break one of them.
 */

import { describe, it, expect } from 'vitest';
import { handicapForPlayer, type LineupHandicaps } from './handicapForPlayer';

/** A lineup with two named players and three empty slots. */
function lineup(overrides: Partial<LineupHandicaps> = {}): LineupHandicaps {
  return {
    player1_id: 'alice',
    player1_handicap: 2,
    player2_id: 'bob',
    player2_handicap: -1,
    player3_id: null,
    player3_handicap: null,
    player4_id: null,
    player4_handicap: null,
    player5_id: null,
    player5_handicap: null,
    swap_new_player_id: null,
    swap_new_player_handicap: null,
    ...overrides,
  };
}

describe('handicapForPlayer', () => {
  it('finds a player in any slot', () => {
    expect(handicapForPlayer(lineup(), 'alice')).toBe(2);
    expect(handicapForPlayer(lineup(), 'bob')).toBe(-1);
  });

  it('reads the fifth slot, not just the first three', () => {
    const l = lineup({ player5_id: 'eve', player5_handicap: 700 });
    expect(handicapForPlayer(l, 'eve')).toBe(700);
  });

  it('finds a substitute, who holds a slot like anyone else', () => {
    const l = lineup({ swap_new_player_id: 'sam', swap_new_player_handicap: 4 });
    expect(handicapForPlayer(l, 'sam')).toBe(4);
  });

  it('prefers the slot a swapped player actually played over the swap record', () => {
    // If someone appears both as a numbered player and in the swap fields, the
    // numbered slot is the one they played under.
    const l = lineup({
      player2_id: 'sam',
      player2_handicap: 3,
      swap_new_player_id: 'sam',
      swap_new_player_handicap: 4,
    });
    expect(handicapForPlayer(l, 'sam')).toBe(3);
  });
});

describe('handicapForPlayer — values that are easy to get wrong', () => {
  it('keeps a zero handicap as 0, not null', () => {
    // Zero is a real handicap in the -2..+2 system. Treating it as "missing"
    // would drop every even player out of a handicap filter.
    const l = lineup({ player1_handicap: 0 });
    expect(handicapForPlayer(l, 'alice')).toBe(0);
  });

  it('keeps a negative handicap', () => {
    expect(handicapForPlayer(lineup(), 'bob')).toBe(-1);
  });

  it('returns null — not 0 — for a player named with no handicap recorded', () => {
    // "Unknown" and "zero" must stay distinguishable: one is missing data, the
    // other is a middling player.
    const l = lineup({ player1_handicap: null });
    expect(handicapForPlayer(l, 'alice')).toBeNull();
  });
});

describe('handicapForPlayer — absent data', () => {
  it('returns null for a player not in this lineup', () => {
    expect(handicapForPlayer(lineup(), 'stranger')).toBeNull();
  });

  it('returns null when there is no lineup', () => {
    expect(handicapForPlayer(null, 'alice')).toBeNull();
    expect(handicapForPlayer(undefined, 'alice')).toBeNull();
  });

  it('returns null when there is no player', () => {
    expect(handicapForPlayer(lineup(), null)).toBeNull();
    expect(handicapForPlayer(lineup(), undefined)).toBeNull();
  });

  it('does not match empty slots against a null player id', () => {
    // Three slots are null here. A loose equality check would match them and
    // hand back a nonsense handicap.
    expect(handicapForPlayer(lineup(), null)).toBeNull();
  });
});
