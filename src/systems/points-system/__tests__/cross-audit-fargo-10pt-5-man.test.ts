/**
 * @fileoverview Cross-audit: FargoRate 10-Point 5-Man composed Points System
 * vs. existing bundled calculator.
 *
 *   1. Legacy bundled: `accumulated_per_game` calculator + manual start_points
 *      addition (the bundled calculator does ONLY per-game accumulation;
 *      start_points is layered separately in the existing runtime).
 *   2. Composed Points System: `buildFargo10pt5ManComposition()` + the runtime
 *      evaluator.
 *
 * Tests both the per-game-only path (start_points = 0) and the start-points-
 * inclusive path (composed adds start_points via receipt triggers; legacy
 * value is the sum of per-game + start_points).
 *
 * @see ../compositions/fargo-10pt-5-man.ts — the composition under audit
 * @see src/systems/calculators/accumulated_per_game.ts — the bundled per-game source of truth
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { accumulatedPerGame } from '@/systems/calculators/accumulated_per_game';
import { evaluatePointsSystem, type RuntimeGameRecord } from '../runtime';
import { buildFargo10pt5ManComposition } from '../compositions/fargo-10pt-5-man';
import type { ThresholdInputs } from '../types';
import { clearRegistry, registerCalculator } from '@/systems/calculators';

beforeAll(() => {
  clearRegistry();
  registerCalculator(accumulatedPerGame);
});

interface GameSpec {
  winnerSide: 'home' | 'away';
  loserBalls: number;
}

function buildRuntimeGames(specs: readonly GameSpec[]): RuntimeGameRecord[] {
  return specs.map((s) => ({
    winnerSide: s.winnerSide,
    winnerCounterInput: null,
    loserCounterInput: s.loserBalls,
  }));
}

function buildLegacyGames(specs: readonly GameSpec[]) {
  // `accumulated_per_game` expects stored game records keyed by winner_team_id
  // / winner_score / loser_score. We use 'HOME' / 'AWAY' as team IDs.
  return specs.map((s) => ({
    winner_team_id: s.winnerSide === 'home' ? 'HOME' : 'AWAY',
    winner_score: 10, // fixed winner points per the Fargo 10-Point config
    loser_score: s.loserBalls,
    is_tiebreaker: false,
  }));
}

const FARGO_PARAMS = {
  winner: { kind: 'fixed' as const, points: 10 },
  loser: { kind: 'counter' as const, min: 0, max: 7, label: 'Balls pocketed by loser' },
};

describe('Cross-audit: Fargo 10-Point 5-Man composed vs. accumulated_per_game legacy', () => {
  describe('per-game accumulation (start_points = 0)', () => {
    // Sample game streams: vary winner side + loser balls. The 5v5 SRR plays
    // 25 games; we generate representative streams that exercise the counter
    // clamp at boundaries (0, 7) plus mid-range values.
    const STREAMS: Array<{ label: string; specs: GameSpec[] }> = [
      {
        label: 'home sweeps with loser pocketing 0',
        specs: Array.from({ length: 25 }, () => ({
          winnerSide: 'home' as const,
          loserBalls: 0,
        })),
      },
      {
        label: 'home sweeps with loser pocketing 7',
        specs: Array.from({ length: 25 }, () => ({
          winnerSide: 'home' as const,
          loserBalls: 7,
        })),
      },
      {
        label: 'mixed 13-12 home, varied balls',
        specs: [
          ...Array.from({ length: 13 }, (_, i) => ({
            winnerSide: 'home' as const,
            loserBalls: i % 8,
          })),
          ...Array.from({ length: 12 }, (_, i) => ({
            winnerSide: 'away' as const,
            loserBalls: (i + 3) % 8,
          })),
        ],
      },
      {
        label: 'all 25 with loser pocketing 3 each',
        specs: Array.from({ length: 25 }, (_, i) => ({
          winnerSide: (i % 2 === 0 ? 'home' : 'away') as 'home' | 'away',
          loserBalls: 3,
        })),
      },
    ];

    for (const stream of STREAMS) {
      it(`${stream.label}: composed home/away points match legacy per-game accumulation`, () => {
        const composition = buildFargo10pt5ManComposition({});
        const inputs: ThresholdInputs = {
          // Slice 4 of Threshold refactor: thresholds now compute from
          // ratings via the FargoFormulaChart rather than reading pre-computed
          // start-points from prefs. Equal lineups → 0 start-points to both
          // sides (weakerTeam = 'even' → both initialHome and initialAway = 0).
          homeRatings: [500, 500, 500, 500, 500],
          awayRatings: [500, 500, 500, 500, 500],
          homeHandicapDiff: 0,
          awayHandicapDiff: 0,
          gameCount: 25,
          prefs: {},
        };
        const state = evaluatePointsSystem(composition, inputs, buildRuntimeGames(stream.specs));

        const legacyGames = buildLegacyGames(stream.specs);
        const expectedHome = accumulatedPerGame.compute(
          { games: legacyGames, teamId: 'HOME' },
          FARGO_PARAMS,
        );
        const expectedAway = accumulatedPerGame.compute(
          { games: legacyGames, teamId: 'AWAY' },
          FARGO_PARAMS,
        );

        expect(state.home_points).toBe(expectedHome);
        expect(state.away_points).toBe(expectedAway);
      });
    }
  });

  describe('start_points layered on top (the FargoRate canonical case)', () => {
    it('initial 56 to away, then per-game accumulation, matches legacy + start_points', () => {
      const specs: GameSpec[] = [
        ...Array.from({ length: 14 }, () => ({
          winnerSide: 'home' as const,
          loserBalls: 2,
        })),
        ...Array.from({ length: 11 }, () => ({
          winnerSide: 'away' as const,
          loserBalls: 4,
        })),
      ];
      const composition = buildFargo10pt5ManComposition({});
      const inputs: ThresholdInputs = {
        // Validated real-match anchor (per docs/research/fargorate-formula.md):
        // home ratings [567,458,493,486,574] vs away [447,394,452,322,374]
        // → 56 start points to away (the weaker team).
        // Slice 4: threshold computes this from ratings rather than reading
        // a pre-computed value from prefs.
        homeRatings: [567, 458, 493, 486, 574],
        awayRatings: [447, 394, 452, 322, 374],
        homeHandicapDiff: 0,
        awayHandicapDiff: 0,
        gameCount: 25,
        prefs: {},
      };
      const state = evaluatePointsSystem(composition, inputs, buildRuntimeGames(specs));

      const legacyGames = buildLegacyGames(specs);
      const legacyHome = accumulatedPerGame.compute(
        { games: legacyGames, teamId: 'HOME' },
        FARGO_PARAMS,
      );
      const legacyAway = accumulatedPerGame.compute(
        { games: legacyGames, teamId: 'AWAY' },
        FARGO_PARAMS,
      );

      // Composed should equal legacy per-game + start_points (56 to away).
      expect(state.home_points).toBe(legacyHome + 0);
      expect(state.away_points).toBe(legacyAway + 56);
    });

    it('start_points fires even with no games (empty match)', () => {
      // Real-match anchor ratings → 56 to away (the weaker team), 0 to home.
      // Slice 4: under the new model, only ONE side gets a non-zero start
      // (the weaker team). Test that start-points fire at match start
      // regardless of game count by running an empty match.
      const composition = buildFargo10pt5ManComposition({});
      const inputs: ThresholdInputs = {
        homeRatings: [567, 458, 493, 486, 574],
        awayRatings: [447, 394, 452, 322, 374],
        homeHandicapDiff: 0,
        awayHandicapDiff: 0,
        gameCount: 25,
        prefs: {},
      };
      const state = evaluatePointsSystem(composition, inputs, []);
      expect(state.home_points).toBe(0); // home is stronger; no start-points
      expect(state.away_points).toBe(56); // away is weaker; gets the head-start
    });
  });
});
