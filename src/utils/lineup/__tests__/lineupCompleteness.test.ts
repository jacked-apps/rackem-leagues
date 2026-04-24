import { describe, it, expect } from 'vitest';
import { computeLineupCompleteness } from '../lineupCompleteness';
import {
  SUB_HOME_ANON_ID,
  SUB_HOME_DD_ID,
  SUB_AWAY_DD_ID,
} from '../substituteHelpers';

describe('computeLineupCompleteness', () => {
  it('returns complete for a full 3-slot lineup of real players', () => {
    const row = {
      player1_id: 'u1', player1_handicap: 5,
      player2_id: 'u2', player2_handicap: 3,
      player3_id: 'u3', player3_handicap: 0,
    };
    const result = computeLineupCompleteness(row, 3);
    expect(result.complete).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.onlyDoubleDutyWaiting).toBe(false);
  });

  it('returns complete for a 5-slot lineup with a captain-entered anon sub', () => {
    const row = {
      player1_id: 'u1', player1_handicap: 500,
      player2_id: 'u2', player2_handicap: 450,
      player3_id: 'u3', player3_handicap: 400,
      player4_id: SUB_HOME_ANON_ID, player4_handicap: 1, // captain-entered
      player5_id: 'u5', player5_handicap: 550,
    };
    const result = computeLineupCompleteness(row, 5);
    expect(result.complete).toBe(true);
  });

  it('is incomplete when a slot has no player_id', () => {
    const row = {
      player1_id: 'u1', player1_handicap: 5,
      player2_id: null, player2_handicap: 0,
      player3_id: 'u3', player3_handicap: 2,
    };
    const result = computeLineupCompleteness(row, 3);
    expect(result.complete).toBe(false);
    expect(result.reasons.some((r) => r.includes('Slot 2'))).toBe(true);
    expect(result.onlyDoubleDutyWaiting).toBe(false);
  });

  it('is incomplete when a slot has a null handicap', () => {
    const row = {
      player1_id: 'u1', player1_handicap: 5,
      player2_id: 'u2', player2_handicap: null,
      player3_id: 'u3', player3_handicap: 2,
    };
    const result = computeLineupCompleteness(row, 3);
    expect(result.complete).toBe(false);
    expect(result.reasons.some((r) => r.includes('handicap'))).toBe(true);
  });

  it('is incomplete when a double-duty placeholder is present (DD waiting only)', () => {
    const row = {
      player1_id: 'u1', player1_handicap: 5,
      player2_id: SUB_HOME_DD_ID, player2_handicap: 0,
      player3_id: 'u3', player3_handicap: 2,
    };
    const result = computeLineupCompleteness(row, 3);
    expect(result.complete).toBe(false);
    expect(result.onlyDoubleDutyWaiting).toBe(true);
    expect(result.reasons).toContain(
      'Waiting for opposing captain to pick the double-duty player'
    );
  });

  it('reports two-subs-picked error when any combination >1 is present', () => {
    const row = {
      player1_id: SUB_HOME_ANON_ID, player1_handicap: 1,
      player2_id: SUB_HOME_DD_ID, player2_handicap: 0,
      player3_id: 'u3', player3_handicap: 2,
    };
    const result = computeLineupCompleteness(row, 3);
    expect(result.complete).toBe(false);
    expect(result.reasons).toContain('At most one substitute per lineup is allowed');
    // Not "only DD waiting" because the two-subs reason is also present
    expect(result.onlyDoubleDutyWaiting).toBe(false);
  });

  it('reports DD-waiting + other reasons as NOT onlyDoubleDutyWaiting', () => {
    const row = {
      player1_id: SUB_HOME_DD_ID, player1_handicap: 0,
      player2_id: null, player2_handicap: 0, // missing player — other reason
      player3_id: 'u3', player3_handicap: 2,
    };
    const result = computeLineupCompleteness(row, 3);
    expect(result.complete).toBe(false);
    expect(result.onlyDoubleDutyWaiting).toBe(false);
  });

  it('ignores slots beyond lineupSize (legacy 4/5 fields on a 3v3)', () => {
    const row = {
      player1_id: 'u1', player1_handicap: 5,
      player2_id: 'u2', player2_handicap: 3,
      player3_id: 'u3', player3_handicap: 0,
      player4_id: SUB_AWAY_DD_ID, // should be ignored for lineupSize=3
      player4_handicap: 0,
    };
    const result = computeLineupCompleteness(row, 3);
    expect(result.complete).toBe(true);
    expect(result.onlyDoubleDutyWaiting).toBe(false);
  });

  it('returns incomplete with clear reason for null lineupRow', () => {
    const result = computeLineupCompleteness(null, 5);
    expect(result.complete).toBe(false);
    expect(result.reasons).toEqual(['Lineup not found']);
  });

  it('treats handicap=0 as valid (valid in points system)', () => {
    const row = {
      player1_id: 'u1', player1_handicap: 0,
      player2_id: 'u2', player2_handicap: 0,
      player3_id: 'u3', player3_handicap: 0,
    };
    const result = computeLineupCompleteness(row, 3);
    expect(result.complete).toBe(true);
  });
});
