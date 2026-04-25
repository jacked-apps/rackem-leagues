import { describe, it, expect } from 'vitest';
import { computePrepBlockedReason } from '../computePrepBlockedReason';
import {
  SUB_HOME_DD_ID,
  SUB_AWAY_DD_ID,
  SUB_HOME_ANON_ID,
} from '../substituteHelpers';

const fullRealLineup = (prefix: 'h' | 'a', size: number) => {
  const row: Record<string, unknown> = {};
  for (let i = 1; i <= size; i++) {
    row[`player${i}_id`] = `${prefix}${i}`;
    row[`player${i}_handicap`] = 500 + i;
  }
  return row;
};

describe('computePrepBlockedReason', () => {
  it('returns null when both lineups are complete and non-Fargo', () => {
    const result = computePrepBlockedReason({
      myLineup: fullRealLineup('h', 5),
      opponentLineup: fullRealLineup('a', 5),
      lineupSize: 5,
      handicapType: 'points',
      isHomeTeam: true,
    });
    expect(result).toBeNull();
  });

  it('returns null when both lineups complete + Fargo both-confirmed', () => {
    const result = computePrepBlockedReason({
      myLineup: fullRealLineup('h', 5),
      opponentLineup: fullRealLineup('a', 5),
      lineupSize: 5,
      handicapType: 'fargo',
      homeGamesToLose: 12345,
      awayGamesToLose: 67890,
      isHomeTeam: true,
    });
    expect(result).toBeNull();
  });

  it('returns fargo_pending when only one side confirmed', () => {
    const result = computePrepBlockedReason({
      myLineup: fullRealLineup('h', 5),
      opponentLineup: fullRealLineup('a', 5),
      lineupSize: 5,
      handicapType: 'fargo',
      homeGamesToLose: 12345,
      awayGamesToLose: null,
      isHomeTeam: true,
    });
    expect(result?.kind).toBe('fargo_pending');
    if (result?.kind === 'fargo_pending') {
      expect(result.myConfirmed).toBe(true);
      expect(result.oppConfirmed).toBe(false);
    }
  });

  it('returns waiting_on_sub_resolution (mine) when my lineup has only a DD sentinel', () => {
    const myRow = { ...fullRealLineup('h', 5), player3_id: SUB_HOME_DD_ID, player3_handicap: 0 };
    const result = computePrepBlockedReason({
      myLineup: myRow,
      opponentLineup: fullRealLineup('a', 5),
      lineupSize: 5,
      handicapType: 'points',
      isHomeTeam: true,
    });
    expect(result?.kind).toBe('waiting_on_sub_resolution');
    if (result?.kind === 'waiting_on_sub_resolution') {
      expect(result.lineupWithPlaceholder).toBe('mine');
    }
  });

  it('returns waiting_on_sub_resolution (opponent) when opponent lineup has DD sentinel', () => {
    const oppRow = { ...fullRealLineup('a', 5), player4_id: SUB_AWAY_DD_ID, player4_handicap: 0 };
    const result = computePrepBlockedReason({
      myLineup: fullRealLineup('h', 5),
      opponentLineup: oppRow,
      lineupSize: 5,
      handicapType: 'points',
      isHomeTeam: true,
    });
    expect(result?.kind).toBe('waiting_on_sub_resolution');
    if (result?.kind === 'waiting_on_sub_resolution') {
      expect(result.lineupWithPlaceholder).toBe('opponent');
    }
  });

  it('returns lineup_incomplete (mine) when my lineup has a null slot', () => {
    const myRow = { ...fullRealLineup('h', 5), player3_id: null, player3_handicap: null };
    const result = computePrepBlockedReason({
      myLineup: myRow,
      opponentLineup: fullRealLineup('a', 5),
      lineupSize: 5,
      handicapType: 'points',
      isHomeTeam: true,
    });
    expect(result?.kind).toBe('lineup_incomplete');
    if (result?.kind === 'lineup_incomplete') {
      expect(result.side).toBe('mine');
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it('precedence: lineup_incomplete beats waiting_on_sub_resolution (DD + other)', () => {
    // My lineup has BOTH a DD sentinel AND a missing player.
    const myRow = {
      ...fullRealLineup('h', 5),
      player2_id: null,
      player2_handicap: null,
      player4_id: SUB_HOME_DD_ID,
      player4_handicap: 0,
    };
    const result = computePrepBlockedReason({
      myLineup: myRow,
      opponentLineup: fullRealLineup('a', 5),
      lineupSize: 5,
      handicapType: 'points',
      isHomeTeam: true,
    });
    expect(result?.kind).toBe('lineup_incomplete');
  });

  it('precedence: lineup_incomplete beats fargo_pending', () => {
    const myRow = { ...fullRealLineup('h', 5), player1_id: null, player1_handicap: null };
    const result = computePrepBlockedReason({
      myLineup: myRow,
      opponentLineup: fullRealLineup('a', 5),
      lineupSize: 5,
      handicapType: 'fargo',
      homeGamesToLose: null,
      awayGamesToLose: null,
      isHomeTeam: true,
    });
    expect(result?.kind).toBe('lineup_incomplete');
  });

  it('precedence: waiting_on_sub_resolution beats fargo_pending', () => {
    const oppRow = { ...fullRealLineup('a', 5), player2_id: SUB_AWAY_DD_ID, player2_handicap: 0 };
    const result = computePrepBlockedReason({
      myLineup: fullRealLineup('h', 5),
      opponentLineup: oppRow,
      lineupSize: 5,
      handicapType: 'fargo',
      homeGamesToLose: null,
      awayGamesToLose: null,
      isHomeTeam: true,
    });
    expect(result?.kind).toBe('waiting_on_sub_resolution');
  });

  it('complete anon sub does NOT block — it is the final state', () => {
    const myRow = {
      ...fullRealLineup('h', 5),
      player3_id: SUB_HOME_ANON_ID,
      player3_handicap: 1, // captain-entered
    };
    const result = computePrepBlockedReason({
      myLineup: myRow,
      opponentLineup: fullRealLineup('a', 5),
      lineupSize: 5,
      handicapType: 'points',
      isHomeTeam: true,
    });
    expect(result).toBeNull();
  });

  it('is isHomeTeam-aware for the Fargo confirm labels', () => {
    // As AWAY team, my confirm is awayGamesToLose.
    const result = computePrepBlockedReason({
      myLineup: fullRealLineup('h', 5),
      opponentLineup: fullRealLineup('a', 5),
      lineupSize: 5,
      handicapType: 'fargo',
      homeGamesToLose: null,
      awayGamesToLose: 67890,
      isHomeTeam: false,
    });
    expect(result?.kind).toBe('fargo_pending');
    if (result?.kind === 'fargo_pending') {
      expect(result.myConfirmed).toBe(true); // I'm away, awayGamesToLose is set
      expect(result.oppConfirmed).toBe(false);
    }
  });
});
