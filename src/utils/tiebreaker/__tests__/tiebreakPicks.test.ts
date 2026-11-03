/**
 * @fileoverview Tests for the tiebreak dropdown rule: same players as the match
 * lineup, only the order changes, double duty counted not deduped.
 */

import { describe, it, expect } from 'vitest';
import { lineupSlotIds, tiebreakChoices } from '../tiebreakPicks';

describe('lineupSlotIds', () => {
  it('keeps a double-duty player in both slots', () => {
    expect(
      lineupSlotIds({ player1_id: 'john', player2_id: 'sara', player3_id: 'john' }, 3),
    ).toEqual(['john', 'sara', 'john']);
  });

  it('reads only the match lineup size and drops empty slots', () => {
    expect(
      lineupSlotIds({ player1_id: 'a', player2_id: null, player3_id: 'c', player4_id: 'd' }, 3),
    ).toEqual(['a', 'c']);
  });

  it('is empty while the lineup is loading', () => {
    expect(lineupSlotIds(null, 3)).toEqual([]);
  });
});

describe('tiebreakChoices', () => {
  const lineup = ['john', 'joe', 'sara'];

  it('offers only the match lineup players — nobody from the roster', () => {
    expect(tiebreakChoices(lineup, ['', '', ''], 1).available).toEqual(['john', 'joe', 'sara']);
  });

  it('disables a player already picked in another position', () => {
    expect(tiebreakChoices(lineup, ['john', '', ''], 2).disabled).toEqual(['john']);
  });

  it('does not disable the player picked in this same position', () => {
    expect(tiebreakChoices(lineup, ['john', '', ''], 1).disabled).toEqual([]);
  });

  it('lets a double-duty player be picked twice, but not three times', () => {
    const dd = ['john', 'sara', 'john'];
    expect(tiebreakChoices(dd, ['john', '', ''], 2).disabled).toEqual([]);
    expect(tiebreakChoices(dd, ['john', 'john', ''], 3).disabled).toEqual(['john']);
  });

  it('lists a double-duty player once (no duplicate dropdown entries)', () => {
    expect(tiebreakChoices(['john', 'sara', 'john'], ['', '', ''], 1).available).toEqual([
      'john',
      'sara',
    ]);
  });
});
