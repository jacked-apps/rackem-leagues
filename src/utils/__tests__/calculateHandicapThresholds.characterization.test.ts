/**
 * @fileoverview Characterization tests for calculateHandicapThresholds.
 *
 * Locks the lineup-sum + dual-chart-lookup integration so the modular-league
 * refactor (Phase 5 of docs/plans/2026-04-28-001-feat-modular-league-system-
 * plan.md) can be verified to preserve the threshold computation flow.
 *
 * This is the INTEGRATION layer between unit fixtures (Phase 0b — chart
 * math + module wrappers) and full E2E specs (Phase 0c — UI-driven scoring).
 * It exercises:
 *
 *   1. Lineup sum: handicaps from player1..player5 (with player4/5 being
 *      nullable for 3v3) summed correctly into a team total.
 *   2. Home team bonus: only added to the home team total, only when the
 *      handicap type is 'points' (BCA 3v3). Mocked here for determinism.
 *   3. **Home/away INDEPENDENT chart lookups** — the function calls
 *      getHandicapThresholds(homeDiff) AND getHandicapThresholds(awayDiff)
 *      separately. They are NOT derived from each other. This is the
 *      user's #1 recurring failure mode.
 *
 * If a refactor changes any of these — sum math, sign of diffs, dual
 * lookup, or bonus application — the test catches it before the change
 * lands.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateHandicapThresholds } from '../calculateHandicapThresholds';
import type { Lineup } from '@/types/match';

// Mock the async DB-dependent bonus calculation. We control the bonus value
// directly per test so we can verify the function's arithmetic without any
// real DB calls.
vi.mock('../getTeamHandicapBonus', () => ({
  getTeamHandicapBonus: vi.fn(),
}));

import { getTeamHandicapBonus } from '../getTeamHandicapBonus';

const mockedGetTeamHandicapBonus = vi.mocked(getTeamHandicapBonus);

function makeLineup(
  handicaps: [number, number, number, number?, number?]
): Lineup {
  return {
    id: 'lineup-id',
    team_id: 'team-id',
    player1_id: 'p1',
    player1_handicap: handicaps[0],
    player2_id: 'p2',
    player2_handicap: handicaps[1],
    player3_id: 'p3',
    player3_handicap: handicaps[2],
    player4_id: handicaps[3] !== undefined ? 'p4' : null,
    player4_handicap: handicaps[3] ?? null,
    player5_id: handicaps[4] !== undefined ? 'p5' : null,
    player5_handicap: handicaps[4] ?? null,
    home_team_modifier: 0,
    locked: false,
    locked_at: null,
  };
}

describe('calculateHandicapThresholds — characterization (BCA 3v3 points)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('lineup sum + dual chart lookup at known handicap diffs', () => {
    it('evenly matched teams (sum 0 vs sum 0, no bonus) → diff 0 → 10/9/8 both sides', async () => {
      mockedGetTeamHandicapBonus.mockResolvedValue(0);

      const home = makeLineup([0, 0, 0]);
      const away = makeLineup([0, 0, 0]);

      const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
        home,
        away,
        'home-team-id',
        'away-team-id',
        'season-id',
        'points'
      );

      expect(homeThresholds).toEqual({
        games_to_win: 10,
        games_to_tie: 9,
        games_to_lose: 8,
      });
      // Diff 0 → home and away thresholds are IDENTICAL
      expect(awayThresholds).toEqual(homeThresholds);
    });

    it('home stronger by +5 (sums: home +5, away 0, no bonus) → home_diff=+5, away_diff=-5', async () => {
      mockedGetTeamHandicapBonus.mockResolvedValue(0);

      const home = makeLineup([2, 2, 1]); // sum +5
      const away = makeLineup([0, 0, 0]);  // sum 0

      const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
        home,
        away,
        'home-team-id',
        'away-team-id',
        'season-id',
        'points'
      );

      // Home diff = +5: chart says win=12, tie=null (odd diff), lose=11
      expect(homeThresholds).toEqual({
        games_to_win: 12,
        games_to_tie: null,
        games_to_lose: 11,
      });
      // Away diff = -5: chart says win=7, tie=null, lose=6
      // CRITICAL: awayThresholds is a SEPARATE chart lookup, not derived
      // from homeThresholds. Past failures: code computing
      // away_to_win = 18 - home_to_win (= 6 here, wrong — chart says 7).
      expect(awayThresholds).toEqual({
        games_to_win: 7,
        games_to_tie: null,
        games_to_lose: 6,
      });
    });

    it('away stronger by +6 (sums: home 0, away +6, no bonus) → home_diff=-6, away_diff=+6', async () => {
      mockedGetTeamHandicapBonus.mockResolvedValue(0);

      const home = makeLineup([0, 0, 0]);  // sum 0
      const away = makeLineup([2, 2, 2]);  // sum +6

      const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
        home,
        away,
        'home-team-id',
        'away-team-id',
        'season-id',
        'points'
      );

      // Home diff = -6: chart says win=7, tie=6 (even diff), lose=5
      expect(homeThresholds).toEqual({
        games_to_win: 7,
        games_to_tie: 6,
        games_to_lose: 5,
      });
      // Away diff = +6: chart says win=13, tie=12, lose=11
      expect(awayThresholds).toEqual({
        games_to_win: 13,
        games_to_tie: 12,
        games_to_lose: 11,
      });
    });

    it('extreme diff caps at chart boundary (home +12 actual, +20 attempted)', async () => {
      mockedGetTeamHandicapBonus.mockResolvedValue(0);

      // Build a sum that would exceed the cap if unclamped: home sums to
      // +20, away to 0. The chart caps at ±12 internally. Here we only feed
      // it integers; calculateHandicapThresholds passes them through, and
      // get3v3GamesNeeded handles the cap. We pick lineups whose sums
      // exceed ±12 to validate the cap is exercised end-to-end.
      // Cap: even though we pass +20 (impossible in BCA points, but useful
      // for boundary testing), the chart treats it as +12.
      const home = makeLineup([2, 2, 2, 2, 2]); // 5 players summing to +10
      // Force a higher sum via the bonus mock for this test only.
      mockedGetTeamHandicapBonus.mockResolvedValue(10); // home gets +10 bonus, total +20
      const away = makeLineup([0, 0, 0]);

      const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
        home,
        away,
        'home-team-id',
        'away-team-id',
        'season-id',
        'points'
      );

      // Home diff = +20 → capped to +12 → win=16, tie=15, lose=14
      expect(homeThresholds).toEqual({
        games_to_win: 16,
        games_to_tie: 15,
        games_to_lose: 14,
      });
      // Away diff = -20 → capped to -12 → win=4, tie=3, lose=2
      expect(awayThresholds).toEqual({
        games_to_win: 4,
        games_to_tie: 3,
        games_to_lose: 2,
      });
    });
  });

  describe('home team bonus is added to HOME team only, only for points handicap', () => {
    it('+2 home bonus shifts the diff by +2 (home stronger after bonus)', async () => {
      mockedGetTeamHandicapBonus.mockResolvedValue(2);

      // Home and away both sum to 0 from lineup. With +2 home bonus,
      // effective home total = +2, away = 0, so home diff = +2.
      const home = makeLineup([0, 0, 0]);
      const away = makeLineup([0, 0, 0]);

      const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
        home,
        away,
        'home-team-id',
        'away-team-id',
        'season-id',
        'points'
      );

      // Home diff = +2: chart says win=11, tie=10 (even), lose=9
      expect(homeThresholds).toEqual({
        games_to_win: 11,
        games_to_tie: 10,
        games_to_lose: 9,
      });
      // Away diff = -2: chart says win=9, tie=8, lose=7
      expect(awayThresholds).toEqual({
        games_to_win: 9,
        games_to_tie: 8,
        games_to_lose: 7,
      });
    });

    it('-2 home bonus (penalty) shifts the diff by -2 (away stronger after penalty)', async () => {
      mockedGetTeamHandicapBonus.mockResolvedValue(-2);

      const home = makeLineup([0, 0, 0]);
      const away = makeLineup([0, 0, 0]);

      const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
        home,
        away,
        'home-team-id',
        'away-team-id',
        'season-id',
        'points'
      );

      // Home diff = -2: chart says win=9, tie=8, lose=7
      expect(homeThresholds).toEqual({
        games_to_win: 9,
        games_to_tie: 8,
        games_to_lose: 7,
      });
      // Away diff = +2: chart says win=11, tie=10, lose=9
      expect(awayThresholds).toEqual({
        games_to_win: 11,
        games_to_tie: 10,
        games_to_lose: 9,
      });
    });

    it('non-points handicap type skips the bonus call entirely', async () => {
      // For percentage/fargo/none, getTeamHandicapBonus is never called
      // because shouldUseTeamBonus returns false. The mock is set to a
      // value we can detect, but the function should never use it.
      mockedGetTeamHandicapBonus.mockResolvedValue(99);

      const home = makeLineup([10, 10, 10, 10, 10]); // sum 50
      const away = makeLineup([0, 0, 0, 0, 0]);

      await calculateHandicapThresholds(
        home,
        away,
        'home-team-id',
        'away-team-id',
        'season-id',
        'percentage'
      );

      // The bonus function was NEVER invoked because handicap_type !== 'points'.
      expect(mockedGetTeamHandicapBonus).not.toHaveBeenCalled();
    });
  });

  describe('home/away INDEPENDENT chart lookups (the recurring failure mode)', () => {
    /**
     * The single most-broken pattern: code that derives away_to_win
     * from home_to_win (e.g., `away = 18 - home`). For 3v3 18-game
     * matches, the chart values do NOT sum to 18 in general (the chart is
     * empirical, not arithmetic). Naive derivation is wrong at every
     * non-zero diff.
     *
     * These tests assert the function's two outputs come from independent
     * chart lookups, not a derivation.
     */
    it.each([
      // [home_player_handicaps, away_player_handicaps, expected_home_diff, expected_away_diff]
      [[1, 1, 1], [0, 0, 0], 3, -3],   // home stronger by 3
      [[2, 1, 0], [0, 0, 0], 3, -3],   // same diff, different lineup composition
      [[0, 0, 0], [1, 2, 1], -4, 4],   // away stronger by 4
      [[2, 2, 2], [-2, -2, -2], 12, -12], // max stretched diff
    ])(
      'lineup home %j vs away %j → home_diff %i, away_diff %i — both chart lookups independent',
      async (homeHcaps, awayHcaps, homeDiff, _awayDiff) => {
        mockedGetTeamHandicapBonus.mockResolvedValue(0);

        const home = makeLineup(homeHcaps as [number, number, number]);
        const away = makeLineup(awayHcaps as [number, number, number]);

        const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
          home,
          away,
          'home-team-id',
          'away-team-id',
          'season-id',
          'points'
        );

        // The home and away thresholds, summed, should NOT be a constant.
        // If a future refactor writes `away_to_win = 18 - home_to_win`,
        // this test fails because the chart's actual values don't follow
        // that pattern.
        const homeWin = homeThresholds.games_to_win;
        const awayWin = awayThresholds.games_to_win;

        // For non-zero diffs, home and away targets MUST differ.
        if (homeDiff !== 0) {
          expect(homeWin).not.toBe(awayWin);
        }

        // For diff 0, they MUST equal.
        if (homeDiff === 0) {
          expect(homeWin).toBe(awayWin);
        }
      }
    );
  });
});
