/**
 * @fileoverview Characterization tests for getGamesNeeded()
 *
 * This test captures the CURRENT behavior of getGamesNeeded() across its full
 * input range. It runs BEFORE the Unit 3 refactor (to establish the baseline)
 * and MUST continue to pass AFTER the refactor (to prove no regression).
 *
 * If any value here changes, either:
 *   (a) Unit 3's SystemModule refactor silently changed BCA behavior — a bug, OR
 *   (b) Someone intentionally updated a chart value — update the snapshot AND
 *       explain the change in the commit message.
 *
 * DO NOT blindly update these values to make the test pass. Investigate first.
 */

import { describe, it, expect } from 'vitest';
import { getGamesNeeded } from '../index';

describe('getGamesNeeded — characterization (points/3v3)', () => {
  // The 3v3 chart covers integer diffs -12..+12. These snapshots capture every
  // entry verbatim so any chart-value drift is caught immediately.
  it.each([
    [-12, { games_to_win: 4, games_to_tie: 3, games_to_lose: 2 }],
    [-11, { games_to_win: 4, games_to_tie: null, games_to_lose: 3 }],
    [-10, { games_to_win: 5, games_to_tie: 4, games_to_lose: 3 }],
    [-9, { games_to_win: 5, games_to_tie: null, games_to_lose: 4 }],
    [-8, { games_to_win: 6, games_to_tie: 5, games_to_lose: 4 }],
    [-7, { games_to_win: 6, games_to_tie: null, games_to_lose: 5 }],
    [-6, { games_to_win: 7, games_to_tie: 6, games_to_lose: 5 }],
    [-5, { games_to_win: 7, games_to_tie: null, games_to_lose: 6 }],
    [-4, { games_to_win: 8, games_to_tie: 7, games_to_lose: 6 }],
    [-3, { games_to_win: 8, games_to_tie: null, games_to_lose: 7 }],
    [-2, { games_to_win: 9, games_to_tie: 8, games_to_lose: 7 }],
    [-1, { games_to_win: 9, games_to_tie: null, games_to_lose: 8 }],
    [0, { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 }],
    [1, { games_to_win: 10, games_to_tie: null, games_to_lose: 9 }],
    [2, { games_to_win: 11, games_to_tie: 10, games_to_lose: 9 }],
    [3, { games_to_win: 11, games_to_tie: null, games_to_lose: 10 }],
    [4, { games_to_win: 12, games_to_tie: 11, games_to_lose: 10 }],
    [5, { games_to_win: 12, games_to_tie: null, games_to_lose: 11 }],
    [6, { games_to_win: 13, games_to_tie: 12, games_to_lose: 11 }],
    [7, { games_to_win: 13, games_to_tie: null, games_to_lose: 12 }],
    [8, { games_to_win: 14, games_to_tie: 13, games_to_lose: 12 }],
    [9, { games_to_win: 14, games_to_tie: null, games_to_lose: 13 }],
    [10, { games_to_win: 15, games_to_tie: 14, games_to_lose: 13 }],
    [11, { games_to_win: 15, games_to_tie: null, games_to_lose: 14 }],
    [12, { games_to_win: 16, games_to_tie: 15, games_to_lose: 14 }],
  ])('getGamesNeeded(%i, "points") matches baseline', (diff, expected) => {
    expect(getGamesNeeded(diff, 'points')).toEqual(expected);
  });

  it('caps diffs above +12 to the +12 entry', () => {
    expect(getGamesNeeded(20, 'points')).toEqual({
      games_to_win: 16,
      games_to_tie: 15,
      games_to_lose: 14,
    });
  });

  it('caps diffs below -12 to the -12 entry', () => {
    expect(getGamesNeeded(-20, 'points')).toEqual({
      games_to_win: 4,
      games_to_tie: 3,
      games_to_lose: 2,
    });
  });

  it('rounds fractional diffs before lookup', () => {
    // 5.4 rounds to 5
    expect(getGamesNeeded(5.4, 'points')).toEqual({
      games_to_win: 12,
      games_to_tie: null,
      games_to_lose: 11,
    });
    // 5.5 rounds to 6 (Math.round behavior)
    expect(getGamesNeeded(5.5, 'points')).toEqual({
      games_to_win: 13,
      games_to_tie: 12,
      games_to_lose: 11,
    });
  });
});

describe('getGamesNeeded — characterization (percentage/5v5)', () => {
  // The 5v5 chart is range-based on absolute diff. These snapshots cover all
  // range boundaries plus negative-diff handling (lower-handicap team lookup).
  describe('positive diffs (higher-handicap team)', () => {
    it.each([
      [0, { games_to_win: 13, games_to_tie: null, games_to_lose: 12 }], // 0-14 range, even match
      [14, { games_to_win: 13, games_to_tie: null, games_to_lose: 12 }], // end of 0-14
      [15, { games_to_win: 14, games_to_tie: null, games_to_lose: 11 }], // start of 15-40
      [40, { games_to_win: 14, games_to_tie: null, games_to_lose: 11 }], // end of 15-40
      [41, { games_to_win: 15, games_to_tie: null, games_to_lose: 10 }], // start of 41-66
      [66, { games_to_win: 15, games_to_tie: null, games_to_lose: 10 }], // end of 41-66
      [67, { games_to_win: 16, games_to_tie: null, games_to_lose: 9 }],  // start of 67-92
      [92, { games_to_win: 16, games_to_tie: null, games_to_lose: 9 }],  // end of 67-92
      [93, { games_to_win: 17, games_to_tie: null, games_to_lose: 8 }],  // start of 93-118
      [118, { games_to_win: 17, games_to_tie: null, games_to_lose: 8 }], // end of 93-118
      [119, { games_to_win: 18, games_to_tie: null, games_to_lose: 7 }], // start of 119-144
      [144, { games_to_win: 18, games_to_tie: null, games_to_lose: 7 }], // end of 119-144
      [145, { games_to_win: 19, games_to_tie: null, games_to_lose: 6 }], // start of 145+
      [500, { games_to_win: 19, games_to_tie: null, games_to_lose: 6 }], // extreme gap, capped
    ])('getGamesNeeded(%i, "percentage") matches baseline', (diff, expected) => {
      expect(getGamesNeeded(diff, 'percentage')).toEqual(expected);
    });
  });

  describe('negative diffs (lower-handicap team)', () => {
    it.each([
      [-14, { games_to_win: 13, games_to_tie: null, games_to_lose: 12 }], // even range reversed
      [-15, { games_to_win: 12, games_to_tie: null, games_to_lose: 13 }], // lower team at 15-40
      [-40, { games_to_win: 12, games_to_tie: null, games_to_lose: 13 }],
      [-41, { games_to_win: 11, games_to_tie: null, games_to_lose: 14 }],
      [-145, { games_to_win: 7, games_to_tie: null, games_to_lose: 18 }], // extreme lower
    ])('getGamesNeeded(%i, "percentage") matches baseline', (diff, expected) => {
      expect(getGamesNeeded(diff, 'percentage')).toEqual(expected);
    });
  });
});

describe('getGamesNeeded — default routing for unmapped types', () => {
  // Current behavior in src/utils/handicap/index.ts: only 'points' hits the 3v3 chart;
  // everything else (including 'fargo', typos, undefined) falls through to 5v5.
  // After Unit 3 refactor, the resolver's fallback preserves this routing.

  it('"fargo" currently routes to the 5v5 chart (behavior to preserve)', () => {
    expect(getGamesNeeded(16, 'fargo')).toEqual(
      getGamesNeeded(16, 'percentage')
    );
  });

  it('unknown handicap types route to the 5v5 chart', () => {
    expect(getGamesNeeded(16, 'unknown_type')).toEqual(
      getGamesNeeded(16, 'percentage')
    );
  });
});
