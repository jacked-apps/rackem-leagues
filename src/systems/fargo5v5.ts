/**
 * @fileoverview Fargo 5v5 SystemModule
 *
 * Fargo-rating-based system for a 5-player lineup single-round-robin format (25 games).
 * Ratings are externally sourced (100-850, manually entered at lineup time until
 * FargoRate API access lands). Point-accumulation scoring: winner 10, loser 0-7
 * by balls pocketed. Start-points awarded to the weaker team at match start.
 *
 * Unit 2 scaffolds this module with teamFormat constants and throwing stubs.
 * Unit 10 replaces the stubs with the real Fargo math (see
 * docs/research/fargorate-formula.md for the formula).
 */

import type { SystemModule } from './types';

const NOT_YET_IMPLEMENTED = 'fargo5v5 behavior not yet implemented (Unit 10 wires it)';

export const fargo5v5: SystemModule = {
  key: 'fargo5v5',

  teamFormat: {
    lineupSize: 5,
    maxRosterSize: 8,
    gameGeneration: 'single_round_robin',
  },

  rating: {
    requiresManualEntry: true,
    displayFormat: () => {
      throw new Error(NOT_YET_IMPLEMENTED);
    },
    validate: () => {
      throw new Error(NOT_YET_IMPLEMENTED);
    },
  },

  scoring: {
    method: 'points_accumulated',
    recordGameOutcome: () => {
      throw new Error(NOT_YET_IMPLEMENTED);
    },
    computeMatchResult: () => {
      throw new Error(NOT_YET_IMPLEMENTED);
    },
  },

  threshold: {
    mode: 'start_points',
    compute: () => {
      throw new Error(NOT_YET_IMPLEMENTED);
    },
  },
};
