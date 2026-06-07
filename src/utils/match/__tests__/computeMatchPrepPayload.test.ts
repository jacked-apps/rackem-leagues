/**
 * @fileoverview Unit tests for `computeMatchPrepPayload` — the standalone
 * `prep_match` payload builder for the LO manual-scoring flow.
 *
 * Fargo branches are pure and cross-checked against the real underlying calcs
 * (`fargo5v5.handicapMechanism.compute`, `computeFargoGamesWonThresholds`,
 * `generateGameOrder`) so the test pins the helper to the same source of truth
 * the live hook uses — no magic numbers. The non-Fargo branch mocks the
 * DB-touching `calculateHandicapThresholds` to assert the mapping + call shape.
 */

import { describe, it, expect, vi } from 'vitest';
import { generatePairings } from '@/systems/pairings';
import { computeGameCount } from '@/systems/team-geometry';
import { computeFargoGamesWonThresholds } from '@/utils/handicap/fargoGamesWonThresholds';
import { fargo5v5 } from '@/systems/fargo5v5';
import {
  computeMatchPrepPayload,
  type MatchPrepLineup,
  type ComputeMatchPrepPayloadArgs,
} from '../computeMatchPrepPayload';

// Mock only the non-Fargo (DB-touching) threshold path.
vi.mock('@/utils/calculateHandicapThresholds', () => ({
  shouldUseTeamBonus: (t: string) => t === 'points',
  calculateHandicapThresholds: vi.fn(async () => ({
    homeThresholds: { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 },
    awayThresholds: { games_to_win: 13, games_to_tie: 12, games_to_lose: 11 },
  })),
}));
import { calculateHandicapThresholds } from '@/utils/calculateHandicapThresholds';

/** Build a lineup of `size` players with given handicaps and `${prefix}{n}` ids. */
function makeLineup(handicaps: number[], prefix: string): MatchPrepLineup {
  const lineup: Record<string, unknown> = {};
  handicaps.forEach((h, i) => {
    lineup[`player${i + 1}_id`] = `${prefix}${i + 1}`;
    lineup[`player${i + 1}_handicap`] = h;
  });
  return lineup as unknown as MatchPrepLineup;
}

const baseArgs = (
  over: Partial<ComputeMatchPrepPayloadArgs>
): ComputeMatchPrepPayloadArgs => ({
  homeLineup: makeLineup([500, 520, 480], 'h'),
  awayLineup: makeLineup([450, 460, 440], 'a'),
  lineupSize: 3,
  handicapType: 'fargo',
  homeTeamId: 'home-team',
  awayTeamId: 'away-team',
  seasonId: 'season-1',
  ...over,
});

describe('computeMatchPrepPayload', () => {
  describe('Fargo + points (start-points)', () => {
    const homeR = [500, 520, 480, 510, 490];
    const awayR = [450, 460, 440, 470, 455];
    const args = baseArgs({
      lineupSize: 5,
      winCondition: 'points',
      homeLineup: makeLineup(homeR, 'h'),
      awayLineup: makeLineup(awayR, 'a'),
    });

    it('puts the computed start-credit on the weaker team\'s to_tie, win/lose null', async () => {
      // Cross-check against the real mechanism the negotiation uses.
      const mech = fargo5v5.handicapMechanism;
      expect(mech?.kind).toBe('start_points');
      const expected = mech!.compute(homeR, awayR, {});

      const { thresholds } = await computeMatchPrepPayload(args);

      expect(thresholds.home_to_win).toBeNull();
      expect(thresholds.away_to_win).toBeNull();
      expect(thresholds.home_to_lose).toBeNull();
      expect(thresholds.away_to_lose).toBeNull();

      if (expected.weakerTeam === 'home') {
        expect(thresholds.home_to_tie).toBe(expected.startPointsForWeakerTeam);
        expect(thresholds.away_to_tie).toBe(0);
      } else if (expected.weakerTeam === 'away') {
        expect(thresholds.away_to_tie).toBe(expected.startPointsForWeakerTeam);
        expect(thresholds.home_to_tie).toBe(0);
      } else {
        expect(thresholds.home_to_tie).toBe(0);
        expect(thresholds.away_to_tie).toBe(0);
      }
    });

    it('rating-matched lineups yield zero credit on both sides', async () => {
      const even = baseArgs({
        lineupSize: 5,
        winCondition: 'points',
        homeLineup: makeLineup([500, 500, 500, 500, 500], 'h'),
        awayLineup: makeLineup([500, 500, 500, 500, 500], 'a'),
      });
      const { thresholds } = await computeMatchPrepPayload(even);
      expect(thresholds.home_to_tie).toBe(0);
      expect(thresholds.away_to_tie).toBe(0);
    });

    it('mechanism="start_points" also routes to start-points (not games-won)', async () => {
      const { thresholds } = await computeMatchPrepPayload(
        baseArgs({
          lineupSize: 5,
          mechanism: 'start_points',
          homeLineup: makeLineup(homeR, 'h'),
          awayLineup: makeLineup(awayR, 'a'),
        })
      );
      // start-points signature: both to_win null.
      expect(thresholds.home_to_win).toBeNull();
      expect(thresholds.away_to_win).toBeNull();
    });
  });

  describe('Fargo + games-won (default)', () => {
    it('matches computeFargoGamesWonThresholds for the same ratings/total', async () => {
      const homeR = [500, 520, 480];
      const awayR = [450, 460, 440];
      const totalGames = computeGameCount(3, 'double_round_robin');
      const expected = computeFargoGamesWonThresholds({
        homeRatings: homeR,
        awayRatings: awayR,
        totalGames,
      });

      const { thresholds } = await computeMatchPrepPayload(
        baseArgs({
          homeLineup: makeLineup(homeR, 'h'),
          awayLineup: makeLineup(awayR, 'a'),
        })
      );

      expect(thresholds.home_to_win).toBe(expected.home.games_to_win);
      expect(thresholds.home_to_tie).toBe(expected.home.games_to_tie);
      expect(thresholds.home_to_lose).toBe(expected.home.games_to_lose);
      expect(thresholds.away_to_win).toBe(expected.away.games_to_win);
      expect(thresholds.away_to_tie).toBe(expected.away.games_to_tie);
      expect(thresholds.away_to_lose).toBe(expected.away.games_to_lose);
    });

    it('computes each side independently for asymmetric ratings', async () => {
      const { thresholds } = await computeMatchPrepPayload(
        baseArgs({
          homeLineup: makeLineup([700, 700, 700], 'h'),
          awayLineup: makeLineup([300, 300, 300], 'a'),
        })
      );
      // A large rating gap should not produce identical home/away win targets.
      expect(thresholds.home_to_win).not.toBe(thresholds.away_to_win);
    });
  });

  describe('non-Fargo (BCA points / percentage)', () => {
    it('maps calculateHandicapThresholds output and passes home/away/season args', async () => {
      const { thresholds } = await computeMatchPrepPayload(
        baseArgs({ handicapType: 'points' })
      );

      expect(thresholds.home_to_win).toBe(10);
      expect(thresholds.home_to_tie).toBe(9);
      expect(thresholds.home_to_lose).toBe(8);
      expect(thresholds.away_to_win).toBe(13);

      expect(calculateHandicapThresholds).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'home-team',
        'away-team',
        'season-1',
        'points'
      );
    });
  });

  describe('game rows', () => {
    it('produces one row per generateGameOrder entry, with matching positions/actions', async () => {
      const order = generatePairings({
        lineupSize: 3,
        gameGeneration: 'double_round_robin',
        homeLineup: ['h1', 'h2', 'h3'],
        awayLineup: ['a1', 'a2', 'a3'],
      });
      const { gameRows } = await computeMatchPrepPayload(baseArgs({}));

      expect(gameRows).toHaveLength(order.length);
      gameRows.forEach((row, i) => {
        expect(row.game_number).toBe(order[i].gameNumber);
        expect(row.home_position).toBe(order[i].homePosition);
        expect(row.away_position).toBe(order[i].awayPosition);
        expect(row.home_action).toBe(order[i].homeAction);
        expect(row.away_action).toBe(order[i].awayAction);
      });
    });

    it('maps player ids from the correct lineup positions', async () => {
      const order = generatePairings({
        lineupSize: 3,
        gameGeneration: 'double_round_robin',
        homeLineup: ['h1', 'h2', 'h3'],
        awayLineup: ['a1', 'a2', 'a3'],
      });
      const { gameRows } = await computeMatchPrepPayload(baseArgs({}));

      gameRows.forEach((row, i) => {
        expect(row.home_player_id).toBe(order[i].homePlayerId);
        expect(row.away_player_id).toBe(order[i].awayPlayerId);
      });
    });

    it('defaults game_type to eight_ball and honors an explicit override', async () => {
      const def = await computeMatchPrepPayload(baseArgs({}));
      expect(def.gameRows[0].game_type).toBe('eight_ball');

      const nine = await computeMatchPrepPayload(baseArgs({ gameType: 'nine_ball' }));
      expect(nine.gameRows[0].game_type).toBe('nine_ball');
    });

    it('single round-robin produces fewer games than double', async () => {
      const single = await computeMatchPrepPayload(
        baseArgs({ gameGeneration: 'single_round_robin' })
      );
      const double = await computeMatchPrepPayload(
        baseArgs({ gameGeneration: 'double_round_robin' })
      );
      expect(single.gameRows.length).toBeLessThan(double.gameRows.length);
    });
  });
});
