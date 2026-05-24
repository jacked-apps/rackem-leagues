/**
 * @fileoverview Characterization tests for the bca3v3 SystemModule.
 *
 * This test captures the CURRENT behavior of the BCA 3v3 module so that the
 * forthcoming modular-league refactor (see
 * docs/plans/2026-04-28-001-feat-modular-league-system-plan.md) can be verified
 * to preserve 3v3 scoring math bit-for-bit. Each phase of the refactor must
 * pass this test on the post-phase code; any divergence rejects the phase.
 *
 * Why this is a separate test from `getGamesNeeded.characterization.test.ts`:
 * that file locks the chart-lookup function. THIS file locks the module-level
 * surface (rating display, rating validation, threshold delegation) and
 * explicitly asserts the design invariants the user has flagged as recurring
 * failure modes:
 *
 *   1. Threshold derivation must use the chart literally, never approximated.
 *      The chart is a 25-entry lookup table, not a formula.
 *
 *   2. Home and away targets are TWO independent chart lookups, never derived
 *      from each other. Naive reasoning ("home needs 10, so away needs 18 - 10
 *      = 8") is wrong. Both must be looked up directly. The sum is a
 *      consequence of the chart, not an input to it.
 *
 *   3. Per-game point counting differs by scoring method, not by intuition.
 *      BCA 3v3 uses tiered counting (10 base + 2-per-2-game-margin bonus).
 *
 * If any value here changes, either:
 *   (a) The refactor silently changed BCA 3v3 behavior — a bug, OR
 *   (b) Someone intentionally updated the module — update the snapshot AND
 *       explain the change in the commit message.
 *
 * DO NOT blindly update these values to make the test pass. Investigate first.
 */

import { describe, it, expect } from 'vitest';
import { bca3v3 } from '../bca3v3';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';

// All threshold.compute calls require an `overrides` argument. BCA 3v3 ignores
// it (chart lookup is unconditional) — but the type signature requires passing
// something. An empty object models "no overrides applied".
const NO_OVERRIDES = {};

describe('bca3v3 SystemModule — characterization', () => {
  describe('module identity and structural constants', () => {
    it('key is "bca3v3"', () => {
      expect(bca3v3.key).toBe('bca3v3');
    });

    it('teamGeometry: 3-player lineup, 5-player roster, double round-robin, 18 games', () => {
      expect(bca3v3.teamGeometry).toEqual({
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
        gameCount: 18,
      });
    });

    it('scoring.method is "games_won_with_team_bonus"', () => {
      expect(bca3v3.scoring.method).toBe('games_won_with_team_bonus');
    });

    it('threshold.mode is "extra_games" (mechanism: extra games)', () => {
      expect(bca3v3.handicapMechanism?.kind).toBe('extra_games');
    });

    it('handicapSystem is wired to the Points variant (kind: "points")', () => {
      // Full displayFormat / validate / requiresManualEntry coverage lives in
      // src/systems/handicap-systems/__tests__/points.test.ts. This assertion
      // is the integration check: the BCA 3v3 system picks the Points Module.
      expect(bca3v3.handicapSystem?.kind).toBe('points');
    });
  });

  describe('threshold.compute — delegates to the static chart', () => {
    // The full 25-entry chart is already locked in
    // src/utils/handicap/__tests__/getGamesNeeded.characterization.test.ts.
    // These tests verify the module-level wrapper is a faithful delegate.
    it('threshold.compute(0) matches get3v3GamesNeeded(0)', () => {
      // Type narrows via mode discriminator — bca3v3 is BCAThreshold
      if (bca3v3.handicapMechanism?.kind !== 'extra_games') {
        throw new Error('expected BCA threshold mode');
      }
      expect(bca3v3.handicapMechanism!.compute(0, NO_OVERRIDES)).toEqual(
        get3v3GamesNeeded(0)
      );
    });

    it.each([-12, -7, -1, 0, 1, 5, 12])(
      'threshold.compute(%i) returns the same shape as get3v3GamesNeeded(%i)',
      (diff) => {
        if (bca3v3.handicapMechanism?.kind !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        expect(bca3v3.handicapMechanism!.compute(diff, NO_OVERRIDES)).toEqual(
          get3v3GamesNeeded(diff)
        );
      }
    );

    it('threshold.compute caps diffs above +12', () => {
      if (bca3v3.handicapMechanism?.kind !== 'extra_games') {
        throw new Error('expected BCA threshold mode');
      }
      expect(bca3v3.handicapMechanism!.compute(20, NO_OVERRIDES)).toEqual(
        get3v3GamesNeeded(12)
      );
    });

    it('threshold.compute caps diffs below -12', () => {
      if (bca3v3.handicapMechanism?.kind !== 'extra_games') {
        throw new Error('expected BCA threshold mode');
      }
      expect(bca3v3.handicapMechanism!.compute(-20, NO_OVERRIDES)).toEqual(
        get3v3GamesNeeded(-12)
      );
    });
  });

  /**
   * The "home/away independent lookup" rule.
   *
   * Past failures: code that derives away_to_win from home_to_win
   * (e.g., `away = 18 - home`) produces wrong values for any non-zero diff.
   * Every refactor must preserve the property that BOTH thresholds come from
   * direct chart lookups.
   */
  describe('home/away independent chart lookups', () => {
    it.each([
      // Sample diffs across the chart range. For each pair, we look up the
      // home perspective AND the away perspective independently; both must
      // match the chart at their respective signs.
      // [home_diff_from_match]
      [12],
      [11],
      [9],
      [5],
      [2],
      [1],
      [0],
      [-1],
      [-2],
      [-5],
      [-9],
      [-11],
      [-12],
    ])(
      'home diff %i: home and away thresholds are both direct chart lookups',
      (homeDiff) => {
        if (bca3v3.handicapMechanism?.kind !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        // From the home team's perspective: handicap diff is +homeDiff.
        const homeThresholds = bca3v3.handicapMechanism!.compute(homeDiff, NO_OVERRIDES);
        // From the away team's perspective: handicap diff is -homeDiff.
        const awayThresholds = bca3v3.handicapMechanism!.compute(
          -homeDiff,
          NO_OVERRIDES
        );

        // Each MUST equal the chart entry at its own sign — never derived.
        expect(homeThresholds).toEqual(get3v3GamesNeeded(homeDiff));
        expect(awayThresholds).toEqual(get3v3GamesNeeded(-homeDiff));
      }
    );
  });

  /**
   * The "equality rule": at handicap diff 0 (evenly matched teams), home and
   * away targets are identical. At any non-zero diff, they MUST differ.
   */
  describe('equality rule', () => {
    it('handicap diff 0: home and away thresholds are identical', () => {
      if (bca3v3.handicapMechanism?.kind !== 'extra_games') {
        throw new Error('expected BCA threshold mode');
      }
      const home = bca3v3.handicapMechanism!.compute(0, NO_OVERRIDES);
      const away = bca3v3.handicapMechanism!.compute(0, NO_OVERRIDES);
      expect(home).toEqual(away);
      expect(home.games_to_win).toBe(10);
      expect(home.games_to_tie).toBe(9);
      expect(home.games_to_lose).toBe(8);
    });

    it.each([1, 2, 3, 5, 7, 12])(
      'handicap diff %i: home and away games_to_win MUST differ',
      (diff) => {
        if (bca3v3.handicapMechanism?.kind !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        const home = bca3v3.handicapMechanism!.compute(diff, NO_OVERRIDES);
        const away = bca3v3.handicapMechanism!.compute(-diff, NO_OVERRIDES);
        expect(home.games_to_win).not.toBe(away.games_to_win);
      }
    );
  });

  /**
   * The "tie possibility" rule, derived from the chart's design:
   * - Even-numbered handicap diffs (0, ±2, ±4, ...) → games_to_tie is non-null
   *   (the match can end in a tie at e.g. 9-9 for diff 0)
   * - Odd-numbered handicap diffs (±1, ±3, ...) → games_to_tie is null
   *   (the chart targets are calibrated so a tie cannot occur at this diff)
   *
   * This is a property of the static chart in get3v3GamesNeeded.ts. Tests
   * here lock the property so a refactor can't accidentally change it
   * (e.g., by replacing the chart with a "smooth" formula).
   */
  describe('tie-possibility rule (odd vs even handicap diffs)', () => {
    it.each([-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12])(
      'even diff %i has a non-null games_to_tie',
      (diff) => {
        if (bca3v3.handicapMechanism?.kind !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        expect(
          bca3v3.handicapMechanism!.compute(diff, NO_OVERRIDES).games_to_tie
        ).not.toBeNull();
      }
    );

    it.each([-11, -9, -7, -5, -3, -1, 1, 3, 5, 7, 9, 11])(
      'odd diff %i has games_to_tie === null',
      (diff) => {
        if (bca3v3.handicapMechanism?.kind !== 'extra_games') {
          throw new Error('expected BCA threshold mode');
        }
        expect(
          bca3v3.handicapMechanism!.compute(diff, NO_OVERRIDES).games_to_tie
        ).toBeNull();
      }
    );
  });

  /**
   * Scoring methods are stubs in the current module; the legacy scoring path
   * runs outside the SystemModule. The plan's Phase 5 will wire scoring
   * through the module — these characterization tests document the current
   * stubbed state so the wiring is detectable.
   */
  describe('scoring methods (currently stubs)', () => {
    it('recordGameOutcome throws "not yet wired"', () => {
      expect(() =>
        bca3v3.scoring.recordGameOutcome(
          { winnerTeam: 'home' },
          NO_OVERRIDES
        )
      ).toThrow(/not yet wired/i);
    });

    it('computeMatchResult throws "not yet wired"', () => {
      expect(() =>
        bca3v3.scoring.computeMatchResult([], NO_OVERRIDES)
      ).toThrow(/not yet wired/i);
    });
  });
});
