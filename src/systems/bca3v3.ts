/**
 * @fileoverview BCA 3v3 SystemModule
 *
 * Handicap system for a 3-player lineup double-round-robin format (18 games).
 * Uses integer point handicaps (-2..+2 standard, -1..+1 reduced).
 * Games-won scoring with team bonus.
 *
 * threshold.compute wraps the existing get3v3GamesNeeded chart.
 * rating.computeFromHistory is NOT exposed through the module in this unit —
 * the existing async calculatePlayerHandicap() in src/utils/calculatePlayerHandicap.ts
 * continues to own that logic (it has DB dependencies and async semantics that
 * don't fit the synchronous module interface cleanly). A future unit can lift
 * that logic into the module once the async/DB concerns are handled.
 *
 * scoring.recordGameOutcome / computeMatchResult are stubs — no BCA caller
 * goes through the module for game recording in v1; the existing scoring
 * mutation pipeline is unchanged. Fargo (Unit 10) is the first consumer of
 * these capabilities.
 */

import type { SystemModule } from './types';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import { getWinCalculator } from './win-calculators';

const NOT_YET_WIRED =
  'bca3v3 scoring module methods not yet wired through SystemModule (legacy paths still in use)';

export const bca3v3: SystemModule = {
  key: 'bca3v3',

  teamFormat: {
    lineupSize: 3,
    maxRosterSize: 5,
    gameGeneration: 'double_round_robin',
  },

  rating: {
    requiresManualEntry: false,
    // computeFromHistory intentionally omitted — see file header.
    displayFormat: (value) => {
      // Points handicap displays with explicit sign for non-zero values: +2, -1, 0
      if (value > 0) return `+${value}`;
      return String(value);
    },
    validate: (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, message: 'Rating must be a number' };
      }
      if (!Number.isInteger(value)) {
        return { ok: false, message: 'Points handicap must be an integer' };
      }
      if (value < -2 || value > 2) {
        return { ok: false, message: 'Points handicap must be between -2 and +2' };
      }
      return { ok: true, value };
    },
  },

  scoring: {
    method: 'games_won_with_team_bonus',
    recordGameOutcome: () => {
      throw new Error(NOT_YET_WIRED);
    },
    computeMatchResult: () => {
      throw new Error(NOT_YET_WIRED);
    },
  },

  threshold: {
    mode: 'extra_games',
    // Delegates to the existing hardcoded chart. No behavior change — the
    // characterization tests in src/utils/handicap/__tests__/getGamesNeeded.characterization.test.ts
    // guarantee this path returns the same values as before the refactor.
    compute: (handicapDiff, overrides) => {
      void overrides; // reserved for future dials (e.g. team_bonus_enabled); not consumed by chart lookup
      return get3v3GamesNeeded(handicapDiff);
    },
  },

  // BCA 3v3 ships with win_condition='games' — a one-entry metric stack with games_won.
  // Per Unit 1 of the modular-framework migration plan, this Module shape replaces the
  // runtime branching on win_condition. Consumers call winCalculator.decide(matchData)
  // instead of switching on win_condition inline.
  winCalculator: getWinCalculator('games'),
};
