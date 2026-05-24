/**
 * @fileoverview Cross-audit: Percentage 5-Man composed Points System vs. existing bundled calculator.
 *
 *   1. Legacy bundled: `accumulate_with_milestone_jumps` calculator (source of truth).
 *   2. Composed Points System: `buildPercent5ManComposition()` + the runtime evaluator.
 *
 * For every (games_to_win, milestone_percent, milestone_jump_value,
 * win_threshold_jump_value, per_game_increment) param set × every
 * (home_wins, away_wins) outcome, the composed Points System's home/away
 * points must equal the bundled calculator's compute output.
 *
 * @see ../compositions/percent-5-man.ts — the composition under audit
 * @see src/systems/calculators/accumulate_with_milestone_jumps.ts — the bundled source of truth
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { accumulateWithMilestoneJumps } from '@/systems/calculators/accumulate_with_milestone_jumps';
import { evaluatePointsSystem, type RuntimeGameRecord } from '../runtime';
import { buildPercent5ManComposition } from '../compositions/percent-5-man';
import type { ThresholdInputs } from '../types';
import { clearRegistry, registerCalculator } from '@/systems/calculators';

beforeAll(() => {
  clearRegistry();
  registerCalculator(accumulateWithMilestoneJumps);
});

function makeGames(homeWinsCount: number, awayWinsCount: number): RuntimeGameRecord[] {
  return [
    ...Array.from({ length: homeWinsCount }, () => ({
      winnerSide: 'home' as const,
      winnerCounterInput: null,
      loserCounterInput: null,
    })),
    ...Array.from({ length: awayWinsCount }, () => ({
      winnerSide: 'away' as const,
      winnerCounterInput: null,
      loserCounterInput: null,
    })),
  ];
}

interface MilestoneParams {
  per_game_increment: number;
  milestone_percent: number;
  milestone_jump_value: number;
  win_threshold_jump_value: number;
}

function legacyComputeForSide(
  gamesWon: number,
  gamesToWin: number,
  params: MilestoneParams,
): number {
  return accumulateWithMilestoneJumps.compute(
    {
      gamesWon,
      thresholds: { games_to_win: gamesToWin, games_to_tie: null, games_to_lose: 0 },
    },
    params,
  );
}

describe('Cross-audit: Percentage 5-Man composed vs. accumulate_with_milestone_jumps legacy', () => {
  // 25-game format (5v5 SRR); test across all reasonable (home_wins, away_wins)
  // outcomes (24 + the case where one side gets every game). milestone_percent
  // and jump values use the CSI default set + a couple of variations.

  const PARAM_SETS: MilestoneParams[] = [
    {
      per_game_increment: 0.1,
      milestone_percent: 0.7,
      milestone_jump_value: 1.5,
      win_threshold_jump_value: 3.0,
    },
    {
      per_game_increment: 0.2,
      milestone_percent: 0.6,
      milestone_jump_value: 2.0,
      win_threshold_jump_value: 5.0,
    },
    {
      per_game_increment: 0.05,
      milestone_percent: 0.8,
      milestone_jump_value: 1.0,
      win_threshold_jump_value: 2.0,
    },
  ];
  const GAMES_TO_WIN = 13;

  describe('every param set × every (home_wins, away_wins) outcome (0..25 each)', () => {
    const outcomes: Array<[number, number]> = [];
    for (let homeWins = 0; homeWins <= 25; homeWins++) {
      // 5v5 SRR is 25 games, so away_wins = 25 - homeWins
      outcomes.push([homeWins, 25 - homeWins]);
    }

    for (let i = 0; i < PARAM_SETS.length; i++) {
      const params = PARAM_SETS[i]!;
      // eslint-disable-next-line vitest/valid-title
      describe(`param set ${i + 1}`, () => {
        it.each(outcomes)(
          'home=%i, away=%i: composed matches legacy for both sides',
          (homeWins, awayWins) => {
            // Trigger Model Lock-In (2026-05-19): jump values (`1.5` and
            // `3.0`) are constants on the trigger rows, baked in at
            // composition-build time from factory params. Threshold inputs
            // (`games_to_win`, `milestone_percent`) still flow through prefs
            // via their `read_pref` / `arithmetic_round_product` operations.
            const composition = buildPercent5ManComposition({
              per_game_increment: params.per_game_increment,
              milestone_jump_value: params.milestone_jump_value,
              win_threshold_jump_value: params.win_threshold_jump_value,
            });
            const inputs: ThresholdInputs = {
              homeRatings: [],
              awayRatings: [],
              homeHandicapDiff: 0,
              awayHandicapDiff: 0,
              gameCount: 25,
              prefs: {
                games_to_win: GAMES_TO_WIN,
                milestone_percent: params.milestone_percent,
              },
            };
            const state = evaluatePointsSystem(
              composition,
              inputs,
              makeGames(homeWins, awayWins),
            );

            const expectedHome = legacyComputeForSide(homeWins, GAMES_TO_WIN, params);
            const expectedAway = legacyComputeForSide(awayWins, GAMES_TO_WIN, params);

            expect(state.home_points).toBeCloseTo(expectedHome, 10);
            expect(state.away_points).toBeCloseTo(expectedAway, 10);
          },
        );
      });
    }
  });
});
