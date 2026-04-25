/**
 * @fileoverview BCA 5v5 SystemModule
 *
 * Handicap system for a 5-player lineup single-round-robin format (25 games).
 * Uses percentage handicaps (0-100 standard, 0-50 reduced).
 * Games-won scoring with team bonus.
 *
 * threshold.compute wraps the existing get5v5GamesNeeded chart.
 * Same stubbing rationale as bca3v3 for rating.computeFromHistory and
 * scoring.* methods — see bca3v3.ts file header.
 */

import type { SystemModule } from './types';
import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';

const NOT_YET_WIRED =
  'bca5v5 scoring module methods not yet wired through SystemModule (legacy paths still in use)';

export const bca5v5: SystemModule = {
  key: 'bca5v5',

  teamFormat: {
    lineupSize: 5,
    maxRosterSize: 8,
    gameGeneration: 'single_round_robin',
  },

  rating: {
    requiresManualEntry: false,
    // computeFromHistory intentionally omitted — see bca3v3.ts file header.
    displayFormat: (value) => `${Math.round(value)}%`,
    validate: (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, message: 'Rating must be a number' };
      }
      if (value < 0 || value > 100) {
        return { ok: false, message: 'Percentage handicap must be between 0 and 100' };
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
    mode: 'games_to_win',
    // Delegates to the existing hardcoded chart. No behavior change.
    compute: (handicapDiff, overrides) => {
      void overrides; // reserved for future dials (e.g. team_bonus_enabled); not consumed by chart lookup
      return get5v5GamesNeeded(handicapDiff);
    },
  },
};
