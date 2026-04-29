/**
 * @fileoverview Characterization tests for the bca5v5 SystemModule.
 *
 * Locks the BCA 5v5 SystemModule's behavior bit-for-bit so the modular-league
 * refactor (docs/plans/2026-04-28-001-feat-modular-league-system-plan.md) can
 * be verified to preserve 5v5 scoring math at every phase. Mirrors the shape
 * of bca3v3.characterization.test.ts but covers 5v5's specifics:
 *
 *   - Range-based chart lookup (7 ranges over 0-500 percentage diff, not a
 *     25-entry exact table like 3v3).
 *   - Percentage handicap (0-100, fractional OK — different from 3v3 which
 *     requires integers).
 *   - 25 total games per match (single round-robin), so games_to_tie is
 *     ALWAYS null (no ties possible at an odd total).
 *   - "Higher team needs more games" property: at every range except 0-14,
 *     the higher-handicap team needs more games to win than the lower-handicap
 *     team — and the values are INDEPENDENT chart lookups, never derived from
 *     each other (file header in get5v5GamesNeeded.ts: "The lower team's
 *     games_to_win is NOT simply (25 - higherTeamWins). Each team has its own
 *     lookup value from the BCA chart").
 *
 * The 7-range chart values themselves are already locked in
 * src/utils/handicap/__tests__/getGamesNeeded.characterization.test.ts.
 * THIS file locks the module-level wrapper plus the design invariants.
 */

import { describe, it, expect } from 'vitest';
import { bca5v5 } from '../bca5v5';
import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';

const NO_OVERRIDES = {};

describe('bca5v5 SystemModule — characterization', () => {
  describe('module identity and structural constants', () => {
    it('key is "bca5v5"', () => {
      expect(bca5v5.key).toBe('bca5v5');
    });

    it('teamFormat: 5-player lineup, 8-player roster, single round-robin', () => {
      expect(bca5v5.teamFormat).toEqual({
        lineupSize: 5,
        maxRosterSize: 8,
        gameGeneration: 'single_round_robin',
      });
    });

    it('scoring.method is "games_won_with_team_bonus"', () => {
      expect(bca5v5.scoring.method).toBe('games_won_with_team_bonus');
    });

    it('threshold.mode is "extra_games" (mechanism: extra games)', () => {
      expect(bca5v5.threshold.mode).toBe('extra_games');
    });

    it('rating.requiresManualEntry is false (BCA derives rating from history)', () => {
      expect(bca5v5.rating.requiresManualEntry).toBe(false);
    });
  });

  describe('rating.displayFormat — percentage handicap', () => {
    it.each([
      [0, '0%'],
      [50, '50%'],
      [100, '100%'],
    ])('value %i displays as "%s"', (value, expected) => {
      expect(bca5v5.rating.displayFormat(value)).toBe(expected);
    });

    it('rounds fractional values for display', () => {
      // 5v5 uses Math.round in the formatter
      expect(bca5v5.rating.displayFormat(33.4)).toBe('33%');
      expect(bca5v5.rating.displayFormat(33.6)).toBe('34%');
      expect(bca5v5.rating.displayFormat(99.5)).toBe('100%'); // banker's rounding caveat: JS rounds .5 up
    });
  });

  describe('rating.validate', () => {
    it.each([0, 25, 50, 75, 100])('accepts valid integer %i', (value) => {
      expect(bca5v5.rating.validate(value)).toEqual({ ok: true, value });
    });

    it('accepts fractional values (different from 3v3)', () => {
      // 5v5 doesn't require integers; percentages can be fractional
      expect(bca5v5.rating.validate(33.5)).toEqual({ ok: true, value: 33.5 });
      expect(bca5v5.rating.validate(0.1)).toEqual({ ok: true, value: 0.1 });
    });

    it('accepts boundary values 0 and 100', () => {
      expect(bca5v5.rating.validate(0)).toEqual({ ok: true, value: 0 });
      expect(bca5v5.rating.validate(100)).toEqual({ ok: true, value: 100 });
    });

    it('rejects strings', () => {
      expect(bca5v5.rating.validate('50')).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it('rejects null', () => {
      expect(bca5v5.rating.validate(null)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it('rejects undefined', () => {
      expect(bca5v5.rating.validate(undefined)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it('rejects NaN', () => {
      expect(bca5v5.rating.validate(NaN)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it.each([Infinity, -Infinity])('rejects %s', (value) => {
      expect(bca5v5.rating.validate(value)).toEqual({
        ok: false,
        message: 'Rating must be a number',
      });
    });

    it.each([-1, -0.1, 100.1, 101, 200])(
      'rejects out-of-range value %f',
      (value) => {
        expect(bca5v5.rating.validate(value)).toEqual({
          ok: false,
          message: 'Percentage handicap must be between 0 and 100',
        });
      }
    );
  });

  describe('threshold.compute — delegates to the range-based chart', () => {
    // The 7-range chart is already locked in
    // src/utils/handicap/__tests__/getGamesNeeded.characterization.test.ts.
    // These tests verify the module-level wrapper is a faithful delegate.
    it.each([0, 14, 15, 40, 66, 92, 118, 144, 145, 500, -14, -15, -40, -145])(
      'threshold.compute(%i) returns same shape as get5v5GamesNeeded(%i)',
      (diff) => {
        if (bca5v5.threshold.mode !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        expect(bca5v5.threshold.compute(diff, NO_OVERRIDES)).toEqual(
          get5v5GamesNeeded(diff)
        );
      }
    );
  });

  /**
   * The "no ties" rule: 25 total games = odd number, so a 5v5 match cannot
   * end in a tie. games_to_tie is ALWAYS null at every range.
   *
   * Locks this property so a refactor can't accidentally introduce a
   * tie-possibility for 5v5 (e.g., by treating the format as "play all 25
   * and split if even points" via a different scoring axis).
   */
  describe('no-ties rule (25 games = odd, ties impossible)', () => {
    it.each([0, 14, 15, 40, 66, 92, 118, 144, 145, 500, -14, -15, -40, -145])(
      'diff %i: games_to_tie is null',
      (diff) => {
        if (bca5v5.threshold.mode !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        expect(
          bca5v5.threshold.compute(diff, NO_OVERRIDES).games_to_tie
        ).toBeNull();
      }
    );
  });

  /**
   * The "home/away independent lookup" rule.
   *
   * Past failures: code that derives away_games_to_win from home_games_to_win
   * (e.g., `away = 25 - home`). The file header in get5v5GamesNeeded.ts is
   * explicit: "The lower team's games_to_win is NOT simply (25 - higher
   * TeamWins). Each team has its own lookup value from the BCA chart."
   *
   * Every refactor must preserve this property.
   */
  describe('home/away independent chart lookups', () => {
    it.each([
      // Sample diffs spanning every range: 0-14 (even), 15-40, 41-66,
      // 67-92, 93-118, 119-144, 145+. For each diff, look up both
      // perspectives independently and confirm both come from the chart.
      [10],   // range 0-14 (even match band)
      [25],   // range 15-40
      [50],   // range 41-66
      [80],   // range 67-92
      [100],  // range 93-118
      [130],  // range 119-144
      [200],  // range 145+
      [-10],  // mirror cases
      [-25],
      [-200],
      [0],
    ])(
      'home diff %i: home and away thresholds are both direct chart lookups',
      (homeDiff) => {
        if (bca5v5.threshold.mode !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        const homeThresholds = bca5v5.threshold.compute(homeDiff, NO_OVERRIDES);
        const awayThresholds = bca5v5.threshold.compute(
          -homeDiff,
          NO_OVERRIDES
        );

        // Each MUST equal the chart entry at its own sign — never derived.
        expect(homeThresholds).toEqual(get5v5GamesNeeded(homeDiff));
        expect(awayThresholds).toEqual(get5v5GamesNeeded(-homeDiff));
      }
    );
  });

  /**
   * The "equality rule" for 5v5 has a wider band than 3v3.
   *
   * 3v3 only treats handicap diff = 0 as evenly matched. 5v5 treats the
   * entire 0-14 range as evenly matched (both teams get the same target
   * within range 1 of the chart). At diffs in 15+, the higher-handicap
   * team needs MORE games than the lower-handicap team — they MUST differ.
   */
  describe('equality rule (range 0-14 = evenly matched)', () => {
    it.each([0, 5, 10, 14])(
      'handicap diff %i (within range 0-14): home and away thresholds are identical',
      (diff) => {
        if (bca5v5.threshold.mode !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        const home = bca5v5.threshold.compute(diff, NO_OVERRIDES);
        const away = bca5v5.threshold.compute(-diff, NO_OVERRIDES);
        expect(home).toEqual(away);
        // Both teams need 13 games of 25 to win in this range
        expect(home.games_to_win).toBe(13);
      }
    );

    it.each([15, 16, 40, 41, 66, 100, 145, 500])(
      'handicap diff %i (outside range 0-14): home and away thresholds MUST differ',
      (diff) => {
        if (bca5v5.threshold.mode !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        const home = bca5v5.threshold.compute(diff, NO_OVERRIDES);
        const away = bca5v5.threshold.compute(-diff, NO_OVERRIDES);
        expect(home.games_to_win).not.toBe(away.games_to_win);
      }
    );
  });

  /**
   * The "higher team needs more" property: outside the 0-14 even-match range,
   * the team with the higher handicap percentage needs more games to win.
   * This is the structural shape of the BCA chart (handicap = expected skill,
   * higher skill needs more wins to keep matches competitive).
   */
  describe('higher-handicap-team-needs-more rule', () => {
    it.each([
      // [diff, expected_higher_team_games_to_win]
      [15, 14],
      [40, 14],
      [41, 15],
      [66, 15],
      [67, 16],
      [92, 16],
      [93, 17],
      [118, 17],
      [119, 18],
      [144, 18],
      [145, 19],
      [500, 19],
    ])(
      'positive diff %i: higher-handicap team needs %i games to win',
      (diff, expected) => {
        if (bca5v5.threshold.mode !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        expect(
          bca5v5.threshold.compute(diff, NO_OVERRIDES).games_to_win
        ).toBe(expected);
      }
    );

    it.each([
      [-15, 12],
      [-40, 12],
      [-41, 11],
      [-66, 11],
      [-67, 10],
      [-92, 10],
      [-93, 9],
      [-118, 9],
      [-119, 8],
      [-144, 8],
      [-145, 7],
      [-500, 7],
    ])(
      'negative diff %i: lower-handicap team needs %i games to win',
      (diff, expected) => {
        if (bca5v5.threshold.mode !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        expect(
          bca5v5.threshold.compute(diff, NO_OVERRIDES).games_to_win
        ).toBe(expected);
      }
    );
  });

  describe('scoring methods (currently stubs)', () => {
    it('recordGameOutcome throws "not yet wired"', () => {
      expect(() =>
        bca5v5.scoring.recordGameOutcome(
          { winnerTeam: 'home' },
          NO_OVERRIDES
        )
      ).toThrow(/not yet wired/i);
    });

    it('computeMatchResult throws "not yet wired"', () => {
      expect(() =>
        bca5v5.scoring.computeMatchResult([], NO_OVERRIDES)
      ).toThrow(/not yet wired/i);
    });
  });
});
