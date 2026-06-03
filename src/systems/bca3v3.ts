/**
 * @fileoverview BCA 3v3 SystemModule
 *
 * Handicap system for a 3-player lineup double-round-robin format (18 games).
 * Uses integer point handicaps (-2..+2 standard, -1..+1 reduced).
 * Games-won scoring with team bonus.
 *
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
 *
 * The rating capability was deleted in Phase D of the Handicap Systems
 * extraction Unit; `handicapSystem: pointsHandicapSystem` is the replacement.
 */

import type { SystemModule } from './types';
import { getTeamGeometry } from './team-geometry';
import { getMatchFormat } from './match-format';
import { pointsHandicapSystem } from './handicap-systems';
import { gamesNeeded3v3Chart } from './threshold-charts';
import { createExtraGamesMechanism } from './handicap-mechanisms';
import { buildPoints3ManComposition } from './points-system/compositions/points-3-man';
import { defaultEnabledSubs } from './sub-modules';

const NOT_YET_WIRED =
  'bca3v3 scoring module methods not yet wired through SystemModule (legacy paths still in use)';

export const bca3v3: SystemModule = {
  key: 'bca3v3',

  // Team Geometry Module — the three structural axes plus derived gameCount.
  // Replaces the legacy teamFormat field (deleted in Phase D of the Team Geometry
  // migration after all consumers were swapped to read teamGeometry instead).
  teamGeometry: getTeamGeometry(3, 5, 'double_round_robin'),

  // Match Format Module — BCA 3v3 ships single_rack pairings (no race_length).
  // Per the Match Format extraction Unit; coexists with any legacy scattered
  // pairing_format/race_length preference reads during the strangler-fig transition.
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

  // Handicap System Module — Points variant (integer ±2 with explicit sign display).
  // Replaces the legacy `rating` capability deleted in Phase D of the Handicap
  // Systems extraction (the field was stranded — declared but never consumed by
  // production code).
  handicapSystem: pointsHandicapSystem,

  // Threshold Chart Module — 3v3 Games-Needed chart (Points × extra_games).
  // Coexists with the legacy `threshold` capability above during the
  // strangler-fig transition; both ultimately call into get3v3GamesNeeded.
  thresholdChart: gamesNeeded3v3Chart,

  // Handicap Mechanism Module — extra_games bound to the 3v3 Games-Needed Chart.
  // Coexists with the legacy `threshold` capability above until Phase D removes it.
  handicapMechanism: createExtraGamesMechanism(gamesNeeded3v3Chart),

  // Points System Module — Points 3-Man composition: end-of-match aggregate
  // (linear_above_threshold) with the locked 3v3 9-9 tie-band absorption.
  // Phase B of the Points System extraction. Coexists with the legacy
  // `scoring` capability + calculator-registry dispatch; Phase C/D will swap
  // consumers and remove the legacy registry.
  pointsSystem: buildPoints3ManComposition({ multiplier: 1 }),

  // Sub kinds offered on the lineup page. Default: both anonymous and
  // double-duty available; LO will toggle via the future workshop.
  enabledSubs: defaultEnabledSubs,
};
