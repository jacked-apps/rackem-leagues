/**
 * @fileoverview Characterization tests for gameOrder utilities.
 *
 * Locks the round-robin game generation that produces:
 *   - 18 games for 3v3 double round-robin (ties possible at 9-9)
 *   - 25 games for 5v5 single round-robin (no ties — odd total)
 *
 * The exact order matters because:
 *   - It determines which player's handicap faces which opponent's
 *   - It determines who breaks vs racks in each game (break-and-run
 *     achievements are conditional on breaking)
 *   - The total game count drives whether ties are possible
 *
 * The 18-game 3v3 pattern is hardcoded as `GAME_ORDER_3V3` and is the
 * source-of-truth reference. The `generateGameOrder` algorithmic
 * generator is verified to produce identical output.
 *
 * Phase 5/Unit 5.4 of the modular-league plan abstracts the tiebreaker
 * game-number arithmetic. The `isTiebreakerGame` predicate locks the
 * current "games 19-21 are tiebreakers" semantics.
 */

import { describe, it, expect } from 'vitest';
import {
  GAME_ORDER_3V3,
  getGameMatchup,
  getAllGames,
  isValidGameNumber,
  isTiebreakerGame,
  generateGameOrder,
  getAllGames5v5,
} from '../gameOrder';

describe('gameOrder — characterization', () => {
  describe('GAME_ORDER_3V3 (the source-of-truth 18-game pattern)', () => {
    it('contains exactly 18 games', () => {
      expect(GAME_ORDER_3V3).toHaveLength(18);
    });

    it('game numbers are 1..18 in order', () => {
      const numbers = GAME_ORDER_3V3.map((g) => g.gameNumber);
      expect(numbers).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
      ]);
    });

    it('every player position 1-3 plays every opponent position 1-3 exactly twice (double round-robin)', () => {
      // Build a 3x3 count grid: counts[home][away] = how many times this matchup occurs
      const counts: number[][] = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      for (const g of GAME_ORDER_3V3) {
        counts[g.homePlayerPosition - 1][g.awayPlayerPosition - 1] += 1;
      }
      // Every cell should be exactly 2 (double round-robin)
      for (let h = 0; h < 3; h += 1) {
        for (let a = 0; a < 3; a += 1) {
          expect(counts[h][a]).toBe(2);
        }
      }
    });

    it('home and away break each get exactly half the games (9 each)', () => {
      const homeBreaks = GAME_ORDER_3V3.filter((g) => g.homeAction === 'breaks');
      const awayBreaks = GAME_ORDER_3V3.filter((g) => g.awayAction === 'breaks');
      expect(homeBreaks).toHaveLength(9);
      expect(awayBreaks).toHaveLength(9);
    });

    it('home_action and away_action are always opposites', () => {
      for (const g of GAME_ORDER_3V3) {
        if (g.homeAction === 'breaks') {
          expect(g.awayAction).toBe('racks');
        } else {
          expect(g.awayAction).toBe('breaks');
        }
      }
    });

    it('round-1 break pattern: home breaks games 1-3 (P1 vs P1, P2 vs P2, P3 vs P3)', () => {
      // First three games are the canonical "home breaks first" lineup
      expect(GAME_ORDER_3V3[0]).toMatchObject({
        gameNumber: 1,
        homePlayerPosition: 1,
        awayPlayerPosition: 1,
        homeAction: 'breaks',
      });
      expect(GAME_ORDER_3V3[1]).toMatchObject({
        gameNumber: 2,
        homePlayerPosition: 2,
        awayPlayerPosition: 2,
        homeAction: 'breaks',
      });
      expect(GAME_ORDER_3V3[2]).toMatchObject({
        gameNumber: 3,
        homePlayerPosition: 3,
        awayPlayerPosition: 3,
        homeAction: 'breaks',
      });
    });
  });

  describe('getGameMatchup(gameNumber)', () => {
    it('returns the matchup for game 1', () => {
      expect(getGameMatchup(1)).toEqual(GAME_ORDER_3V3[0]);
    });

    it('returns the matchup for game 18', () => {
      expect(getGameMatchup(18)).toEqual(GAME_ORDER_3V3[17]);
    });

    it('returns undefined for game 19 (tiebreaker, not in regular order)', () => {
      expect(getGameMatchup(19)).toBeUndefined();
    });

    it('returns undefined for game 0', () => {
      expect(getGameMatchup(0)).toBeUndefined();
    });

    it('returns undefined for negative game numbers', () => {
      expect(getGameMatchup(-1)).toBeUndefined();
    });
  });

  describe('getAllGames returns the canonical 18-game array', () => {
    it('returns the same reference as GAME_ORDER_3V3', () => {
      expect(getAllGames()).toBe(GAME_ORDER_3V3);
    });
  });

  describe('isValidGameNumber (regular-play range)', () => {
    it.each([1, 2, 9, 10, 17, 18])('game %i is valid', (n) => {
      expect(isValidGameNumber(n)).toBe(true);
    });

    it.each([0, -1, 19, 20, 21, 100])('game %i is NOT valid', (n) => {
      expect(isValidGameNumber(n)).toBe(false);
    });
  });

  describe('isTiebreakerGame (games 19-21 are tiebreakers)', () => {
    it.each([19, 20, 21])('game %i IS a tiebreaker', (n) => {
      expect(isTiebreakerGame(n)).toBe(true);
    });

    it.each([1, 17, 18, 22, 100])('game %i is NOT a tiebreaker', (n) => {
      expect(isTiebreakerGame(n)).toBe(false);
    });

    /**
     * Critical for Unit 5.4 (tiebreaker game-number abstraction): the
     * current logic assumes 18-game match → tiebreakers at 19/20/21.
     * Any future generic `tiebreakerGameNumbers(matchTotalGames, count)`
     * must produce [19,20,21] for matchTotalGames=18, count=3.
     */
    it('locks the 18+1, 18+2, 18+3 = tiebreaker contract for 3v3 18-game matches', () => {
      // Game 18 + 1 = 19 (first tiebreaker)
      expect(isTiebreakerGame(19)).toBe(true);
      // Game 18 + 2 = 20
      expect(isTiebreakerGame(20)).toBe(true);
      // Game 18 + 3 = 21 (last tiebreaker in best-of-3)
      expect(isTiebreakerGame(21)).toBe(true);
      // 22 = beyond best-of-3, not a tiebreaker
      expect(isTiebreakerGame(22)).toBe(false);
    });
  });

  describe('generateGameOrder(playersPerTeam, doubleRoundRobin)', () => {
    describe('3-player double round-robin (matches GAME_ORDER_3V3)', () => {
      const generated = generateGameOrder(3, true);

      it('produces 18 games', () => {
        expect(generated).toHaveLength(18);
      });

      it('produces exactly the same matchup pairs as the hardcoded GAME_ORDER_3V3', () => {
        // The pairings must match (home-position, away-position) at each game
        // number. Break/rack action may differ between the hardcoded and
        // generated forms — the hardcoded one has a specific empirical pattern;
        // the generated one alternates per round. We lock the pairing
        // equivalence here, not the action sequence.
        const pairsHardcoded = GAME_ORDER_3V3.map((g) => [
          g.homePlayerPosition,
          g.awayPlayerPosition,
        ]);
        const pairsGenerated = generated.map((g) => [
          g.homePlayerPosition,
          g.awayPlayerPosition,
        ]);
        expect(pairsGenerated).toEqual(pairsHardcoded);
      });

      it('every player position 1-3 plays every opponent position 1-3 exactly twice', () => {
        const counts: number[][] = [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ];
        for (const g of generated) {
          counts[g.homePlayerPosition - 1][g.awayPlayerPosition - 1] += 1;
        }
        for (let h = 0; h < 3; h += 1) {
          for (let a = 0; a < 3; a += 1) {
            expect(counts[h][a]).toBe(2);
          }
        }
      });
    });

    describe('5-player single round-robin (default for 5v5 BCA / Fargo presets)', () => {
      const generated = generateGameOrder(5, false);

      it('produces 25 games', () => {
        expect(generated).toHaveLength(25);
      });

      it('every player position 1-5 plays every opponent position 1-5 exactly once (single RR)', () => {
        const counts: number[][] = Array.from({ length: 5 }, () =>
          Array(5).fill(0)
        );
        for (const g of generated) {
          counts[g.homePlayerPosition - 1][g.awayPlayerPosition - 1] += 1;
        }
        for (let h = 0; h < 5; h += 1) {
          for (let a = 0; a < 5; a += 1) {
            expect(counts[h][a]).toBe(1);
          }
        }
      });

      it('25 is odd: ties impossible AT THIS PRESET — but lineup size and RR mode are independent axes; a 5v5 DRR would have 50 games and CAN tie at 25-25', () => {
        // Lock the design property: 5v5 SRR has 25 games (odd).
        // IMPORTANT: this is ONLY true for the SRR preset. The modular
        // refactor (R1 lineup size + R3 match structure as INDEPENDENT
        // axes) means an LO could configure 5v5 + double round-robin →
        // 50 games (even) → ties possible. Don't derive tie-possibility
        // from lineup size alone.
        expect(generated.length).toBe(25);
        expect(generated.length % 2).toBe(1);
      });
    });

    /**
     * Cross-combo tests — the modular plan (R1 + R3) treats lineup size
     * and match structure as INDEPENDENT axes. The current presets pin
     * specific combos (3v3=DRR, 5v5=SRR) but the underlying generator
     * supports any (lineupSize, doubleRoundRobin) pair. These tests lock
     * that the generator produces correct game counts and round-robin
     * coverage for the non-preset combos so the refactor doesn't need to
     * touch this layer.
     */
    describe('cross-combos: any lineup size + any RR mode (modular plan R1 × R3)', () => {
      it('3v3 SINGLE round-robin → 9 games (odd, no ties at the format level)', () => {
        const games = generateGameOrder(3, false);
        expect(games).toHaveLength(9); // 3 × 3 × 1
        expect(games.length % 2).toBe(1);
      });

      it('4v4 SINGLE round-robin → 16 games (even, ties possible 8-8)', () => {
        const games = generateGameOrder(4, false);
        expect(games).toHaveLength(16); // 4 × 4 × 1
        expect(games.length % 2).toBe(0);
      });

      it('4v4 DOUBLE round-robin → 32 games (even, ties possible 16-16)', () => {
        const games = generateGameOrder(4, true);
        expect(games).toHaveLength(32); // 4 × 4 × 2
        expect(games.length % 2).toBe(0);
      });

      it('5v5 DOUBLE round-robin → 50 games (even, ties possible 25-25)', () => {
        const games = generateGameOrder(5, true);
        expect(games).toHaveLength(50); // 5 × 5 × 2
        expect(games.length % 2).toBe(0);
      });

      it('6v6 SINGLE round-robin → 36 games', () => {
        const games = generateGameOrder(6, false);
        expect(games).toHaveLength(36); // 6 × 6 × 1
      });

      it('6v6 DOUBLE round-robin → 72 games', () => {
        const games = generateGameOrder(6, true);
        expect(games).toHaveLength(72); // 6 × 6 × 2
      });

      it('every cross-combo covers the full pairing matrix the right number of times', () => {
        const cases: Array<[number, boolean, number]> = [
          [3, false, 1], // 3v3 SRR: each pair once
          [3, true, 2],  // 3v3 DRR: each pair twice
          [4, false, 1],
          [4, true, 2],
          [5, false, 1],
          [5, true, 2],
          [6, false, 1],
          [6, true, 2],
        ];
        for (const [n, drr, expectedCount] of cases) {
          const games = generateGameOrder(n, drr);
          const counts: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
          for (const g of games) {
            counts[g.homePlayerPosition - 1][g.awayPlayerPosition - 1] += 1;
          }
          for (let h = 0; h < n; h += 1) {
            for (let a = 0; a < n; a += 1) {
              expect(counts[h][a]).toBe(expectedCount);
            }
          }
        }
      });

      it('break-action alternates per round regardless of lineup size or RR mode', () => {
        // Round 0: home breaks. Round 1: away breaks. Etc.
        for (const n of [3, 4, 5, 6]) {
          for (const drr of [true, false]) {
            const games = generateGameOrder(n, drr);
            // First game of each round should match the round's alternation
            for (let round = 0; round < (drr ? n * 2 : n); round += 1) {
              const firstGameOfRound = games[round * n];
              const homeBreaks = round % 2 === 0;
              expect(firstGameOfRound.homeAction).toBe(homeBreaks ? 'breaks' : 'racks');
              expect(firstGameOfRound.awayAction).toBe(homeBreaks ? 'racks' : 'breaks');
            }
          }
        }
      });
    });

    describe('boundary cases', () => {
      it('1-player single round-robin → 1 game', () => {
        const games = generateGameOrder(1, false);
        expect(games).toHaveLength(1);
        expect(games[0]).toMatchObject({
          gameNumber: 1,
          homePlayerPosition: 1,
          awayPlayerPosition: 1,
        });
      });

      it('1-player double round-robin → 2 games', () => {
        const games = generateGameOrder(1, true);
        expect(games).toHaveLength(2);
      });

      it('break action alternates per round', () => {
        const games = generateGameOrder(3, true);
        // Games 1-3 are round 0 (homeBreaks=true)
        expect(games[0].homeAction).toBe('breaks');
        expect(games[2].homeAction).toBe('breaks');
        // Games 4-6 are round 1 (homeBreaks=false)
        expect(games[3].homeAction).toBe('racks');
        expect(games[5].homeAction).toBe('racks');
      });

      it('default doubleRoundRobin is true (matches 3v3 default)', () => {
        const games = generateGameOrder(3); // no second arg
        expect(games).toHaveLength(18);
      });
    });
  });

  describe('getAllGames5v5', () => {
    it('returns 25 games (single round-robin)', () => {
      expect(getAllGames5v5()).toHaveLength(25);
    });

    it('matches generateGameOrder(5, false)', () => {
      expect(getAllGames5v5()).toEqual(generateGameOrder(5, false));
    });
  });
});
