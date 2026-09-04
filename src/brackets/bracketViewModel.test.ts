/**
 * @fileoverview Tests for the bracket view-model (Unit 5).
 *
 * Name resolution + winner highlighting, grouping by side/round, slot
 * pickability, and champion detection (single-elim final + double-elim grand
 * final / reset).
 */

import { describe, it, expect } from 'vitest';
import {
  buildBracketView,
  isSlotPickable,
  championName,
  type ViewMatch,
  type ViewParticipant,
} from './bracketViewModel';

const participants: ViewParticipant[] = [
  { id: 'p1', display_name: 'Ann', seed: 1 },
  { id: 'p2', display_name: 'Bo', seed: 2 },
  { id: 'p3', display_name: 'Cy', seed: 3 },
  { id: 'p4', display_name: 'Di', seed: 4 },
];

/** Minimal match factory. */
function m(over: Partial<ViewMatch> & Pick<ViewMatch, 'id' | 'round' | 'side' | 'slot'>): ViewMatch {
  return {
    home_participant_id: null,
    away_participant_id: null,
    winner_participant_id: null,
    status: 'pending',
    is_reset_match: false,
    ...over,
  };
}

describe('buildBracketView', () => {
  it('resolves names, groups winners by round, marks the winner', () => {
    const matches: ViewMatch[] = [
      m({ id: 'w1a', round: 1, side: 'winners', slot: 0, home_participant_id: 'p1', away_participant_id: 'p4', winner_participant_id: 'p1', status: 'complete' }),
      m({ id: 'w1b', round: 1, side: 'winners', slot: 1, home_participant_id: 'p2', away_participant_id: 'p3', status: 'ready' }),
      m({ id: 'w2', round: 2, side: 'winners', slot: 0, home_participant_id: 'p1', status: 'pending' }),
    ];
    const view = buildBracketView(participants, matches);

    expect(view.winners).toHaveLength(2); // 2 rounds
    expect(view.winners[0]).toHaveLength(2);
    expect(view.winners[0][0].home.name).toBe('Ann');
    expect(view.winners[0][0].home.isWinner).toBe(true);
    expect(view.winners[0][0].away.isWinner).toBe(false);
    expect(view.winners[1][0].away.name).toBeNull(); // TBD slot
    expect(view.hasLosers).toBe(false);
  });

  it('separates losers + grand final for double-elim', () => {
    const matches: ViewMatch[] = [
      m({ id: 'w', round: 1, side: 'winners', slot: 0 }),
      m({ id: 'l', round: 1, side: 'losers', slot: 0 }),
      m({ id: 'gf', round: 1, side: 'grand_final', slot: 0 }),
      m({ id: 'gfr', round: 2, side: 'grand_final', slot: 0, is_reset_match: true }),
    ];
    const view = buildBracketView(participants, matches);
    expect(view.hasLosers).toBe(true);
    expect(view.grandFinal).toHaveLength(2);
    // Reset sorts after the plain grand final.
    expect(view.grandFinal[0].isResetMatch).toBe(false);
    expect(view.grandFinal[1].isResetMatch).toBe(true);
  });
});

describe('isSlotPickable', () => {
  it('is pickable only for a ready match with a filled slot', () => {
    const view = buildBracketView(participants, [
      m({ id: 'r', round: 1, side: 'winners', slot: 0, home_participant_id: 'p1', away_participant_id: 'p2', status: 'ready' }),
      m({ id: 'p', round: 1, side: 'winners', slot: 1, home_participant_id: 'p3', status: 'pending' }),
    ]);
    const [ready, pendingM] = view.winners[0];
    expect(isSlotPickable(ready, 'home')).toBe(true);
    expect(isSlotPickable(pendingM, 'home')).toBe(false); // not ready
  });
});

describe('championName', () => {
  it('single-elim: winner of the last winners match', () => {
    const view = buildBracketView(participants, [
      m({ id: 'w1', round: 1, side: 'winners', slot: 0, status: 'complete', winner_participant_id: 'p1', home_participant_id: 'p1', away_participant_id: 'p2' }),
      m({ id: 'final', round: 2, side: 'winners', slot: 0, status: 'complete', home_participant_id: 'p1', away_participant_id: 'p3', winner_participant_id: 'p1' }),
    ]);
    expect(championName(view)).toBe('Ann');
  });

  it('double-elim: prefers a completed reset decider over the grand final', () => {
    const view = buildBracketView(participants, [
      m({ id: 'gf', round: 1, side: 'grand_final', slot: 0, status: 'complete', home_participant_id: 'p1', away_participant_id: 'p2', winner_participant_id: 'p2' }),
      m({ id: 'gfr', round: 2, side: 'grand_final', slot: 0, is_reset_match: true, status: 'complete', home_participant_id: 'p1', away_participant_id: 'p2', winner_participant_id: 'p2' }),
    ]);
    expect(championName(view)).toBe('Bo');
  });

  it('returns null while the terminal is unfinished', () => {
    const view = buildBracketView(participants, [
      m({ id: 'final', round: 1, side: 'winners', slot: 0, status: 'ready', home_participant_id: 'p1', away_participant_id: 'p2' }),
    ]);
    expect(championName(view)).toBeNull();
  });
});
