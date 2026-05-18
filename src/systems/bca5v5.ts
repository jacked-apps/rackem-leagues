/**
 * @fileoverview BCA 5v5 SystemModule
 *
 * Handicap system for a 5-player lineup single-round-robin format (25 games).
 * Uses percentage handicaps (0-100 standard, 0-50 reduced).
 * Games-won scoring with team bonus.
 *
 * Same stubbing rationale as bca3v3 for rating.computeFromHistory and
 * scoring.* methods — see bca3v3.ts file header.
 */

import type { SystemModule } from './types';
import { getWinCalculator } from './win-calculators';
import { getTeamGeometry } from './team-geometry';
import { getMatchFormat } from './match-format';
import { percentageHandicapSystem } from './handicap-systems';
import { gamesNeeded5v5Chart } from './threshold-charts';
import { createExtraGamesMechanism } from './handicap-mechanisms';

const NOT_YET_WIRED =
  'bca5v5 scoring module methods not yet wired through SystemModule (legacy paths still in use)';

export const bca5v5: SystemModule = {
  key: 'bca5v5',

  // Team Geometry Module — the three structural axes plus derived gameCount.
  // Replaces the legacy teamFormat field (Phase D of the Team Geometry migration).
  teamGeometry: getTeamGeometry(5, 8, 'single_round_robin'),

  // Match Format Module — BCA 5v5 ships single_rack pairings (no race_length).
  // See bca3v3.ts for the strangler-fig rationale.
  matchFormat: getMatchFormat('single_rack', null),

  scoring: {
    method: 'games_won_with_team_bonus',
    recordGameOutcome: () => {
      throw new Error(NOT_YET_WIRED);
    },
    computeMatchResult: () => {
      throw new Error(NOT_YET_WIRED);
    },
  },

  // BCA 5v5 ships with win_condition='games' — a one-entry metric stack with games_won.
  // See bca3v3.ts for the rationale; same shape applies here.
  winCalculator: getWinCalculator('games'),

  // Handicap System Module — Percentage variant (0–100 with `%` display).
  // Replaces the legacy `rating` capability deleted in Phase D.
  handicapSystem: percentageHandicapSystem,

  // Threshold Chart Module — 5v5 Games-Needed chart (Percentage × extra_games).
  // See bca3v3.ts for the strangler-fig rationale; coexists with `threshold` until Phase D.
  thresholdChart: gamesNeeded5v5Chart,

  // Handicap Mechanism Module — extra_games bound to the 5v5 Games-Needed Chart.
  // Coexists with `threshold` until Phase D.
  handicapMechanism: createExtraGamesMechanism(gamesNeeded5v5Chart),
};
