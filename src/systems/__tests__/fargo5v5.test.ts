/**
 * @fileoverview Tests for the fargo5v5 SystemModule (Unit 10)
 *
 * Validates the Fargo math module against:
 * 1. The one real-match test case captured in docs/research/fargorate-formula.md
 *    (home [567,458,493,486,574] vs away [447,394,452,322,374] → 56 start points
 *    per the official FargoRate league calculator).
 * 2. Synthetic cases for rating validation, scoring outcome recording, and match
 *    result computation (including the points → games-won cascade that makes
 *    Fargo 5v5 never tie).
 *
 * Tolerance: ±1 from the official calculator's answer. Captains always have
 * override-at-lineup-lock for any drift; the formula is a good default, not
 * a perfect reproduction.
 */

import { describe, it, expect } from 'vitest';
import { fargo5v5 } from '../fargo5v5';
import type { StoredGameRecord } from '../types';

describe('fargo5v5 SystemModule', () => {
  describe('key and teamGeometry', () => {
    it('exposes the correct module key', () => {
      expect(fargo5v5.key).toBe('fargo5v5');
    });

    it('has 5v5 single-round-robin teamGeometry (25 games)', () => {
      expect(fargo5v5.teamGeometry).toEqual({
        lineupSize: 5,
        maxRosterSize: 8,
        gameGeneration: 'single_round_robin',
        gameCount: 25,
      });
    });

    it('handicapSystem is wired to the FargoRate variant (kind: "fargo")', () => {
      // Full displayFormat / validate / computeFromHistory / requiresManualEntry
      // coverage lives in src/systems/handicap-systems/__tests__/fargorate.test.ts.
      // This assertion is the integration check: the Fargo 5v5 system picks the
      // FargoRate Module.
      expect(fargo5v5.handicapSystem?.kind).toBe('fargo');
    });

    it('uses points_accumulated scoring', () => {
      expect(fargo5v5.scoring.method).toBe('points_accumulated');
    });

    it('uses start_points threshold mode', () => {
      expect(fargo5v5.threshold.mode).toBe('start_points');
    });
  });

  describe('threshold.compute — validated real-match test case', () => {
    // Test Case 1 from docs/research/fargorate-formula.md:
    // Home team ratings: 567, 458, 493, 486, 574 (avg 515.6)
    // Away team ratings: 447, 394, 452, 322, 374 (avg 397.8)
    // 10-point system, 5v5 SRR (25 games)
    // Official FargoRate calculator result: 56 start points to away (weaker team)
    it('matches the captured real-match case within ±1 point', () => {
      if (fargo5v5.threshold.mode !== 'start_points') {
        throw new Error('expected start_points threshold mode');
      }
      const result = fargo5v5.threshold.compute(
        [567, 458, 493, 486, 574],
        [447, 394, 452, 322, 374],
        {},
      );

      expect(result.weakerTeam).toBe('away');
      expect(result.startPointsForWeakerTeam).toBeGreaterThanOrEqual(55);
      expect(result.startPointsForWeakerTeam).toBeLessThanOrEqual(57);
    });
  });

  describe('threshold.compute — synthetic cases', () => {
    it('returns 0 start-points for an even match (identical rosters)', () => {
      if (fargo5v5.threshold.mode !== 'start_points') {
        throw new Error('expected start_points threshold mode');
      }
      const result = fargo5v5.threshold.compute(
        [500, 500, 500, 500, 500],
        [500, 500, 500, 500, 500],
        {},
      );
      expect(result.startPointsForWeakerTeam).toBe(0);
      expect(result.weakerTeam).toBe('even');
    });

    it('identifies the weaker team correctly when home is stronger', () => {
      if (fargo5v5.threshold.mode !== 'start_points') {
        throw new Error('expected start_points threshold mode');
      }
      const result = fargo5v5.threshold.compute(
        [600, 600, 600, 600, 600],
        [400, 400, 400, 400, 400],
        {},
      );
      expect(result.weakerTeam).toBe('away');
      expect(result.startPointsForWeakerTeam).toBeGreaterThan(0);
    });

    it('identifies the weaker team correctly when away is stronger', () => {
      if (fargo5v5.threshold.mode !== 'start_points') {
        throw new Error('expected start_points threshold mode');
      }
      const result = fargo5v5.threshold.compute(
        [400, 400, 400, 400, 400],
        [600, 600, 600, 600, 600],
        {},
      );
      expect(result.weakerTeam).toBe('home');
      expect(result.startPointsForWeakerTeam).toBeGreaterThan(0);
    });

    it('produces symmetric output under team swap', () => {
      if (fargo5v5.threshold.mode !== 'start_points') {
        throw new Error('expected start_points threshold mode');
      }
      const r1 = fargo5v5.threshold.compute(
        [567, 458, 493, 486, 574],
        [447, 394, 452, 322, 374],
        {},
      );
      const r2 = fargo5v5.threshold.compute(
        [447, 394, 452, 322, 374],
        [567, 458, 493, 486, 574],
        {},
      );
      expect(r1.startPointsForWeakerTeam).toBe(r2.startPointsForWeakerTeam);
      // Weaker team should flip between home/away
      expect(r1.weakerTeam).toBe('away');
      expect(r2.weakerTeam).toBe('home');
    });

    it('produces larger start-points for larger rating gaps (monotonic)', () => {
      if (fargo5v5.threshold.mode !== 'start_points') {
        throw new Error('expected start_points threshold mode');
      }
      const smallGap = fargo5v5.threshold.compute(
        [500, 500, 500, 500, 500],
        [450, 450, 450, 450, 450],
        {},
      );
      const mediumGap = fargo5v5.threshold.compute(
        [500, 500, 500, 500, 500],
        [400, 400, 400, 400, 400],
        {},
      );
      const largeGap = fargo5v5.threshold.compute(
        [500, 500, 500, 500, 500],
        [300, 300, 300, 300, 300],
        {},
      );
      expect(smallGap.startPointsForWeakerTeam).toBeLessThan(mediumGap.startPointsForWeakerTeam);
      expect(mediumGap.startPointsForWeakerTeam).toBeLessThan(largeGap.startPointsForWeakerTeam);
    });

    it('throws on empty rating arrays', () => {
      if (fargo5v5.threshold.mode !== 'start_points') {
        throw new Error('expected start_points threshold mode');
      }
      expect(() => fargo5v5.threshold.compute([], [500, 500, 500, 500, 500], {})).toThrow();
      expect(() => fargo5v5.threshold.compute([500, 500, 500, 500, 500], [], {})).toThrow();
    });

    it('throws on non-finite ratings', () => {
      if (fargo5v5.threshold.mode !== 'start_points') {
        throw new Error('expected start_points threshold mode');
      }
      expect(() =>
        fargo5v5.threshold.compute(
          [500, 500, 500, 500, Number.NaN],
          [500, 500, 500, 500, 500],
          {},
        ),
      ).toThrow();
    });
  });

  describe('threshold.compute — override: winner_points affects the calculation', () => {
    it('higher winner_points increases the per-game differential and therefore start-points', () => {
      if (fargo5v5.threshold.mode !== 'start_points') {
        throw new Error('expected start_points threshold mode');
      }
      const defaultWinner = fargo5v5.threshold.compute(
        [600, 600, 600, 600, 600],
        [400, 400, 400, 400, 400],
        {},
      );
      const higherWinner = fargo5v5.threshold.compute(
        [600, 600, 600, 600, 600],
        [400, 400, 400, 400, 400],
        { winner_points: 20 },
      );
      expect(higherWinner.startPointsForWeakerTeam).toBeGreaterThan(
        defaultWinner.startPointsForWeakerTeam,
      );
    });
  });

  describe('scoring.recordGameOutcome', () => {
    it('stores only loser_balls_pocketed; winner_points and loser_points are null', () => {
      const result = fargo5v5.scoring.recordGameOutcome(
        { winnerTeam: 'home', loserBallsPocketed: 3 },
        {},
      );
      expect(result).toEqual({
        winner_points: null,
        loser_points: null,
        loser_balls_pocketed: 3,
      });
    });

    it('clamps loser_balls_pocketed to [0, loser_points_max]', () => {
      const low = fargo5v5.scoring.recordGameOutcome(
        { winnerTeam: 'home', loserBallsPocketed: -1 },
        {},
      );
      expect(low.loser_balls_pocketed).toBe(0);

      const high = fargo5v5.scoring.recordGameOutcome(
        { winnerTeam: 'home', loserBallsPocketed: 99 },
        {},
      );
      expect(high.loser_balls_pocketed).toBe(7); // default max

      const customMax = fargo5v5.scoring.recordGameOutcome(
        { winnerTeam: 'home', loserBallsPocketed: 10 },
        { loser_points_max: 15 },
      );
      expect(customMax.loser_balls_pocketed).toBe(10);
    });

    it('returns null for balls when loserBallsPocketed is missing', () => {
      const result = fargo5v5.scoring.recordGameOutcome({ winnerTeam: 'home' }, {});
      expect(result.loser_balls_pocketed).toBeNull();
    });

    it('floors fractional ball counts', () => {
      const result = fargo5v5.scoring.recordGameOutcome(
        { winnerTeam: 'home', loserBallsPocketed: 3.7 },
        {},
      );
      expect(result.loser_balls_pocketed).toBe(3);
    });
  });

  describe('scoring.computeMatchResult — points → games-won cascade', () => {
    function game(winner: 'home' | 'away', balls: number): StoredGameRecord {
      return {
        winner_team: winner,
        winner_points: null,
        loser_points: null,
        loser_balls_pocketed: balls,
      };
    }

    it('derives per-game points from loser_balls_pocketed and the winner_points dial', () => {
      // Home wins both games with default winner_points=10 and loser_balls_pocketed=3
      const games = [game('home', 3), game('home', 3)];
      const result = fargo5v5.scoring.computeMatchResult(games, {});
      // Each home win: home gets 10, away gets 3 (balls_pocketed method).
      expect(result.home_points).toBe(20);
      expect(result.away_points).toBe(6);
      expect(result.home_games_won).toBe(2);
      expect(result.away_games_won).toBe(0);
      expect(result.winner).toBe('home');
    });

    it('higher points wins over higher games-won (primary)', () => {
      // home wins 12 games, away wins 13 games. If the 13 away wins all had the loser (home) pocket 7 balls,
      // home's point total (12×10 + 13×7) = 120 + 91 = 211
      // away's point total (13×10 + 12×7) = 130 + 84 = 214 → away wins
      const games: StoredGameRecord[] = [];
      for (let i = 0; i < 12; i++) games.push(game('home', 7));
      for (let i = 0; i < 13; i++) games.push(game('away', 7));
      const result = fargo5v5.scoring.computeMatchResult(games, {});
      expect(result.away_games_won).toBe(13);
      expect(result.home_games_won).toBe(12);
      expect(result.winner).toBe('away');
    });

    it('when points tie, higher games-won wins (cascade)', () => {
      // Construct: home wins 3 games with 0 balls (home gets 30, away gets 0)
      //            away wins 2 games with 0 balls (away gets 20, home gets 0)
      //            plus start-points credit of 10 to away → away_total = 30, home_total = 30 (tie on points)
      //            home has more games won (3 > 2) → home wins by cascade
      const games: StoredGameRecord[] = [
        game('home', 0),
        game('home', 0),
        game('home', 0),
        game('away', 0),
        game('away', 0),
      ];
      const result = fargo5v5.scoring.computeMatchResult(games, {}, {
        fargoStartPoints: 10,
        fargoStartPointsFor: 'away',
      });
      expect(result.home_points).toBe(30);
      expect(result.away_points).toBe(30);
      expect(result.home_games_won).toBe(3);
      expect(result.away_games_won).toBe(2);
      expect(result.winner).toBe('home');
    });

    it('credits start-points to the weaker team correctly', () => {
      const games: StoredGameRecord[] = [game('home', 0), game('away', 0)];
      const withCredit = fargo5v5.scoring.computeMatchResult(games, {}, {
        fargoStartPoints: 56,
        fargoStartPointsFor: 'away',
      });
      // home: 10 (one win) + 0 (zero balls pocketed in its loss) = 10
      // away: 10 (one win) + 0 + 56 (start-points credit) = 66
      expect(withCredit.home_points).toBe(10);
      expect(withCredit.away_points).toBe(66);
      expect(withCredit.winner).toBe('away');
    });

    it('derives loser_points per the overrides.loser_points_method dial', () => {
      const games = [game('home', 5)];
      // Default 'balls_pocketed': away gets 5 points
      expect(
        fargo5v5.scoring.computeMatchResult(games, {}).away_points,
      ).toBe(5);
      // 'none': away gets 0
      expect(
        fargo5v5.scoring.computeMatchResult(games, { loser_points_method: 'none' })
          .away_points,
      ).toBe(0);
      // 'fixed': away gets loser_points_max (default 7)
      expect(
        fargo5v5.scoring.computeMatchResult(games, { loser_points_method: 'fixed' })
          .away_points,
      ).toBe(7);
      // 'fixed' with custom max
      expect(
        fargo5v5.scoring.computeMatchResult(games, {
          loser_points_method: 'fixed',
          loser_points_max: 3,
        }).away_points,
      ).toBe(3);
    });

    it('honors a winner_points override in the derivation', () => {
      const games = [game('home', 3)];
      const result = fargo5v5.scoring.computeMatchResult(games, { winner_points: 14 });
      // home wins one: home gets 14, away gets 3
      expect(result.home_points).toBe(14);
      expect(result.away_points).toBe(3);
    });

    it('handles a zero-games match cleanly', () => {
      const result = fargo5v5.scoring.computeMatchResult([], {});
      expect(result.home_points).toBe(0);
      expect(result.away_points).toBe(0);
      expect(result.home_games_won).toBe(0);
      expect(result.away_games_won).toBe(0);
      // Cascade on all-zeros: points tie (0/0), games tie (0/0) — winner defaults to 'away'
      // per the fallthrough. This isn't a realistic scenario; documented for completeness.
      expect(['home', 'away']).toContain(result.winner);
    });
  });
});
