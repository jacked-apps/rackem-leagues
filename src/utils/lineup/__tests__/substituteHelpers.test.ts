import { describe, it, expect } from 'vitest';
import {
  SUB_HOME_ANON_ID,
  SUB_AWAY_ANON_ID,
  SUB_HOME_DD_ID,
  SUB_AWAY_DD_ID,
  SUB_HOME_ID,
  SUB_AWAY_ID,
  isAnonSubSentinel,
  isDoubleDutySentinel,
  isAnySubSentinel,
  getAnonSubId,
  getDoubleDutySubId,
  lineupHasSubstitute,
  lineupHasDoubleDuty,
} from '../substituteHelpers';

describe('substituteHelpers', () => {
  describe('sentinel constants', () => {
    it('legacy SUB_HOME_ID aliases the new anon sentinel', () => {
      expect(SUB_HOME_ID).toBe(SUB_HOME_ANON_ID);
    });

    it('legacy SUB_AWAY_ID aliases the new anon sentinel', () => {
      expect(SUB_AWAY_ID).toBe(SUB_AWAY_ANON_ID);
    });

    it('DD sentinels are distinct from ANON sentinels', () => {
      expect(SUB_HOME_DD_ID).not.toBe(SUB_HOME_ANON_ID);
      expect(SUB_AWAY_DD_ID).not.toBe(SUB_AWAY_ANON_ID);
    });
  });

  describe('isAnonSubSentinel', () => {
    it('returns true for home anon sentinel', () => {
      expect(isAnonSubSentinel(SUB_HOME_ANON_ID)).toBe(true);
    });

    it('returns true for away anon sentinel', () => {
      expect(isAnonSubSentinel(SUB_AWAY_ANON_ID)).toBe(true);
    });

    it('returns false for DD sentinels', () => {
      expect(isAnonSubSentinel(SUB_HOME_DD_ID)).toBe(false);
      expect(isAnonSubSentinel(SUB_AWAY_DD_ID)).toBe(false);
    });

    it('returns false for real UUIDs, null, undefined, empty string', () => {
      expect(isAnonSubSentinel('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(false);
      expect(isAnonSubSentinel(null)).toBe(false);
      expect(isAnonSubSentinel(undefined)).toBe(false);
      expect(isAnonSubSentinel('')).toBe(false);
    });
  });

  describe('isDoubleDutySentinel', () => {
    it('returns true for DD sentinels only', () => {
      expect(isDoubleDutySentinel(SUB_HOME_DD_ID)).toBe(true);
      expect(isDoubleDutySentinel(SUB_AWAY_DD_ID)).toBe(true);
      expect(isDoubleDutySentinel(SUB_HOME_ANON_ID)).toBe(false);
      expect(isDoubleDutySentinel(SUB_AWAY_ANON_ID)).toBe(false);
    });

    it('returns false for real UUIDs, null, undefined, empty string', () => {
      expect(isDoubleDutySentinel('real-uuid')).toBe(false);
      expect(isDoubleDutySentinel(null)).toBe(false);
      expect(isDoubleDutySentinel(undefined)).toBe(false);
      expect(isDoubleDutySentinel('')).toBe(false);
    });
  });

  describe('isAnySubSentinel', () => {
    it('returns true for any of the four sentinels', () => {
      expect(isAnySubSentinel(SUB_HOME_ANON_ID)).toBe(true);
      expect(isAnySubSentinel(SUB_AWAY_ANON_ID)).toBe(true);
      expect(isAnySubSentinel(SUB_HOME_DD_ID)).toBe(true);
      expect(isAnySubSentinel(SUB_AWAY_DD_ID)).toBe(true);
    });

    it('returns false for real UUIDs', () => {
      expect(isAnySubSentinel('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(false);
    });
  });

  describe('getAnonSubId / getDoubleDutySubId', () => {
    it('returns the home ANON id when isHomeTeam=true', () => {
      expect(getAnonSubId(true)).toBe(SUB_HOME_ANON_ID);
    });

    it('returns the away ANON id when isHomeTeam=false', () => {
      expect(getAnonSubId(false)).toBe(SUB_AWAY_ANON_ID);
    });

    it('returns the home DD id when isHomeTeam=true', () => {
      expect(getDoubleDutySubId(true)).toBe(SUB_HOME_DD_ID);
    });

    it('returns the away DD id when isHomeTeam=false', () => {
      expect(getDoubleDutySubId(false)).toBe(SUB_AWAY_DD_ID);
    });
  });

  describe('lineupHasSubstitute', () => {
    it('returns true when any slot has an anon sub', () => {
      const row = {
        player1_id: 'real-1',
        player2_id: SUB_HOME_ANON_ID,
        player3_id: 'real-3',
      };
      expect(lineupHasSubstitute(row, 3)).toBe(true);
    });

    it('returns true when any slot has a DD sub', () => {
      const row = {
        player1_id: 'real-1',
        player2_id: 'real-2',
        player3_id: 'real-3',
        player4_id: SUB_HOME_DD_ID,
        player5_id: 'real-5',
      };
      expect(lineupHasSubstitute(row, 5)).toBe(true);
    });

    it('returns false when no slots have subs', () => {
      const row = {
        player1_id: 'real-1',
        player2_id: 'real-2',
        player3_id: 'real-3',
      };
      expect(lineupHasSubstitute(row, 3)).toBe(false);
    });

    it('only iterates slots up to lineupSize (ignores legacy 4/5 on a 3v3)', () => {
      const row = {
        player1_id: 'real-1',
        player2_id: 'real-2',
        player3_id: 'real-3',
        player4_id: SUB_HOME_DD_ID, // should be ignored for lineupSize=3
        player5_id: 'real-5',
      };
      expect(lineupHasSubstitute(row, 3)).toBe(false);
    });
  });

  describe('lineupHasDoubleDuty', () => {
    it('returns true only when a DD sentinel is present', () => {
      const ddRow = { player1_id: 'real-1', player2_id: SUB_HOME_DD_ID, player3_id: 'real-3' };
      const anonRow = { player1_id: 'real-1', player2_id: SUB_HOME_ANON_ID, player3_id: 'real-3' };
      const realRow = { player1_id: 'real-1', player2_id: 'real-2', player3_id: 'real-3' };
      expect(lineupHasDoubleDuty(ddRow, 3)).toBe(true);
      expect(lineupHasDoubleDuty(anonRow, 3)).toBe(false);
      expect(lineupHasDoubleDuty(realRow, 3)).toBe(false);
    });
  });
});
